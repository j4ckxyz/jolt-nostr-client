import os
import sqlite3
import json
from datetime import datetime
from flask import Flask, render_template, request, jsonify
import google.generativeai as genai
import numpy as np

app = Flask(__name__)

genai.configure(api_key=os.environ.get('GEMINI_API_KEY'))

DB_PATH = 'tweets.db'

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS tweets
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  text TEXT NOT NULL,
                  author TEXT NOT NULL,
                  topic TEXT,
                  embedding TEXT,
                  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)''')
    
    seed_tweets = [
        ("Just hit a home run in the bottom of the ninth! ⚾ #baseball #sports", "SportsGuy99", "sports"),
        ("Three strikes and you're out! That's how baseball works! #MLB", "BaseballFan", "sports"),
        ("Amazing game at the stadium today! The crowd went wild! 🏟️", "StadiumLover", "sports"),
        ("The Mets are on fire this season! 🔥 #LGM", "MetsSuperfan", "sports"),
        
        ("Just launched my new ML model with 98% accuracy! 🤖 #machinelearning #AI", "DataScientist_", "tech"),
        ("Transformers are revolutionizing NLP! The attention mechanism is genius 🧠", "AIResearcher", "tech"),
        ("Finally got my Python script working after 3 hours of debugging 😅 #coding", "DevLife123", "tech"),
        ("Anyone else excited about the new GPT model? #LLM #AI", "TechEnthusiast", "tech"),
        
        ("Nothing beats a fresh cup of coffee in the morning ☕", "CoffeeLover22", "lifestyle"),
        ("Tried a new recipe today - homemade pasta from scratch! 🍝", "FoodieAdventures", "lifestyle"),
        ("Sunset at the beach never gets old 🌅 #beach #sunset", "NatureLover", "lifestyle"),
        ("Yoga and meditation changed my life! 🧘 #wellness", "MindfulLiving", "lifestyle"),
        
        ("Market analysis: Tech stocks showing strong momentum 📈 #investing", "FinanceGuru", "finance"),
        ("Interest rates are affecting mortgage applications significantly #realestate", "EconWatcher", "finance"),
        ("Bitcoin volatility continues - what's your prediction? 💰 #crypto", "CryptoTrader99", "finance"),
        ("Diversification is key to a solid portfolio 📊 #investing101", "WealthBuilder", "finance"),
        
        ("New album dropping tonight! Can't wait! 🎵 #music", "MusicJunkie", "entertainment"),
        ("Just finished binge-watching the entire series! Best show ever! 📺", "SeriesAddict", "entertainment"),
        ("Concert tickets secured! This is going to be epic! 🎸", "ConcertGoer", "entertainment"),
        ("Movie night with popcorn and good company 🍿🎬", "FilmBuff2024", "entertainment"),
    ]
    
    c.execute('SELECT COUNT(*) FROM tweets')
    if c.fetchone()[0] == 0:
        for text, author, topic in seed_tweets:
            embedding = get_embedding(text)
            c.execute('INSERT INTO tweets (text, author, topic, embedding) VALUES (?, ?, ?, ?)',
                     (text, author, topic, json.dumps(embedding)))
    
    conn.commit()
    conn.close()

def get_embedding(text):
    try:
        result = genai.embed_content(
            model="models/text-embedding-004",
            content=text,
            task_type="retrieval_document"
        )
        return result['embedding']
    except Exception as e:
        print(f"Error getting embedding: {e}")
        return [0.0] * 768

def cosine_similarity(a, b):
    a = np.array(a)
    b = np.array(b)
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/tweets')
def get_tweets():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT id, text, author, topic, timestamp FROM tweets ORDER BY timestamp DESC')
    tweets = [{'id': row[0], 'text': row[1], 'author': row[2], 'topic': row[3], 'timestamp': row[4]} 
              for row in c.fetchall()]
    conn.close()
    return jsonify(tweets)

@app.route('/api/tweet', methods=['POST'])
def create_tweet():
    data = request.json
    text = data.get('text')
    author = data.get('author', 'Anonymous')
    
    if not text:
        return jsonify({'error': 'Text is required'}), 400
    
    embedding = get_embedding(text)
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('INSERT INTO tweets (text, author, embedding) VALUES (?, ?, ?)',
             (text, author, json.dumps(embedding)))
    tweet_id = c.lastrowid
    conn.commit()
    conn.close()
    
    return jsonify({'id': tweet_id, 'text': text, 'author': author})

@app.route('/api/similar/<int:tweet_id>')
def get_similar_tweets(tweet_id):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    c.execute('SELECT embedding FROM tweets WHERE id = ?', (tweet_id,))
    result = c.fetchone()
    if not result:
        conn.close()
        return jsonify({'error': 'Tweet not found'}), 404
    
    target_embedding = json.loads(result[0])
    
    c.execute('SELECT id, text, author, topic, embedding FROM tweets WHERE id != ?', (tweet_id,))
    all_tweets = c.fetchall()
    
    similarities = []
    for row in all_tweets:
        tweet_embedding = json.loads(row[4])
        similarity = cosine_similarity(target_embedding, tweet_embedding)
        similarities.append({
            'id': row[0],
            'text': row[1],
            'author': row[2],
            'topic': row[3],
            'similarity': float(similarity)
        })
    
    similarities.sort(key=lambda x: x['similarity'], reverse=True)
    conn.close()
    
    return jsonify(similarities[:10])

@app.route('/api/analyze', methods=['POST'])
def analyze_tweet():
    data = request.json
    text = data.get('text')
    
    if not text:
        return jsonify({'error': 'Text is required'}), 400
    
    embedding = get_embedding(text)
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT id, text, author, topic, embedding FROM tweets')
    all_tweets = c.fetchall()
    
    similarities = []
    for row in all_tweets:
        tweet_embedding = json.loads(row[4])
        similarity = cosine_similarity(embedding, tweet_embedding)
        similarities.append({
            'id': row[0],
            'text': row[1],
            'author': row[2],
            'topic': row[3],
            'similarity': float(similarity)
        })
    
    similarities.sort(key=lambda x: x['similarity'], reverse=True)
    conn.close()
    
    return jsonify({
        'similar_tweets': similarities[:5],
        'embedding_preview': embedding[:10]
    })

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)
