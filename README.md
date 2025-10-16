# TwHIN-BERT Tweet Similarity Explorer

An interactive web application demonstrating how Twitter's TwHIN-BERT algorithm finds relevant tweets using socially-enriched embeddings.

## Features

- 🐦 **Twitter-like UI**: Familiar feed interface with tweet composition
- 🧠 **Real-time Similarity Analysis**: See which tweets are semantically similar using embeddings
- 🔍 **Live Embedding**: Uses Gemini API to generate embeddings for new tweets
- 📊 **Visual Scoring**: Similarity scores and progress bars show relevance
- 💾 **SQLite Storage**: All tweets persisted locally
- 🎯 **Topic Clustering**: Pre-seeded tweets across sports, tech, lifestyle, finance, and entertainment

## How TwHIN-BERT Works

Twitter's TwHIN-BERT algorithm enhances traditional BERT with social signals:

1. **Heterogeneous Information Network**: Builds a graph of users and tweets connected by engagements (faves, retweets, replies)
2. **Social Embeddings**: Learns that tweets engaged by similar users should have similar embeddings
3. **Dual Training**: Combines masked language modeling (MLM) with contrastive social loss
4. **Similarity Search**: Uses cosine similarity in embedding space to find relevant content

## Setup

1. **Install dependencies**:
```bash
pip install -r requirements.txt
```

2. **Set your Gemini API key**:
```bash
export GEMINI_API_KEY="your-api-key-here"
```

Get a free API key at: https://ai.google.dev/

3. **Run the app**:
```bash
python app.py
```

4. **Open your browser**:
Navigate to `http://localhost:5000`

## Usage

### Explore Existing Tweets
- Click any tweet in the feed to see its most similar tweets
- Similarity scores range from 0-100% based on embedding closeness
- Notice how sports tweets cluster together, tech tweets group, etc.

### Compose New Tweets
1. Type your tweet in the compose box
2. Click "🔍 Analyze Similarity" to see which existing tweets it's most similar to
3. Click "📤 Post Tweet" to add it to the database
4. Your tweet gets embedded using Gemini's API and stored with its embedding

### Real-time Analysis
- Watch the algorithm compute cosine similarity between embeddings
- See the first 10 dimensions of the 768-dimensional embedding vector
- Understand how semantic meaning translates to vector space proximity

## Technical Architecture

- **Backend**: Flask (Python)
- **Embeddings**: Google Gemini API (text-embedding-004 model)
- **Database**: SQLite with JSON-stored embeddings
- **Frontend**: Vanilla JavaScript with Twitter-inspired CSS
- **Similarity**: Cosine distance in 768-dimensional space

## Database Schema

```sql
CREATE TABLE tweets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    author TEXT NOT NULL,
    topic TEXT,
    embedding TEXT,  -- JSON array of 768 floats
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

## API Endpoints

- `GET /api/tweets` - Fetch all tweets
- `POST /api/tweet` - Create new tweet with embedding
- `GET /api/similar/<id>` - Get top 10 similar tweets
- `POST /api/analyze` - Analyze text without saving

## Sample Topics

The app comes pre-seeded with 20 tweets across:
- ⚾ **Sports**: Baseball, stadiums, teams
- 💻 **Tech**: ML, AI, coding, transformers
- ☕ **Lifestyle**: Coffee, food, wellness, nature
- 💰 **Finance**: Stocks, crypto, investing
- 🎬 **Entertainment**: Music, movies, concerts

## Learning Points

This demo illustrates key concepts from the TwHIN-BERT paper:

- **Social vs Semantic**: TwHIN-BERT learns both text meaning AND social appeal
- **Co-engagement**: Tweets engaged by similar users should be similar
- **Embedding Space**: High-dimensional vectors capture nuanced relationships
- **Transfer Learning**: Pre-trained embeddings work across topics
- **Scalability**: FAISS-style ANN search handles billions of tweets

## Extending the App

Ideas for enhancement:
- Add user profiles with engagement history
- Implement engagement prediction (fave/retweet likelihood)
- Visualize embeddings with t-SNE or UMAP
- Add hashtag prediction based on content
- Create topic clustering visualization
- Implement temporal dynamics (trending topics)

## References

- TwHIN-BERT Paper: https://arxiv.org/abs/2209.07562
- Gemini API Docs: https://ai.google.dev/docs
- Original TwHIN-BERT Model: https://huggingface.co/Twitter/twhin-bert-base

## License

MIT - See TwHIN-BERT.md for research paper details
