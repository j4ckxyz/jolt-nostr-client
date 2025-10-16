from datetime import datetime
from typing import Optional

from server import config
from server.database import Post, Whitelist, Like
from embedding_service import get_embedding, cosine_similarity
import json

uri = config.FEED_URI
CURSOR_EOF = 'eof'


def handler(cursor: Optional[str], limit: int, requester_did: str) -> dict:
    if not Whitelist.select().where(Whitelist.did == requester_did).exists():
        return {'cursor': CURSOR_EOF, 'feed': []}

    # Get user's recent posts and likes
    user_posts = Post.select().where(Post.author == requester_did).order_by(Post.indexed_at.desc()).limit(100)
    user_likes = Like.select().where(Like.author == requester_did).order_by(Like.indexed_at.desc()).limit(100)

    user_post_embeddings = [json.loads(post.embedding) for post in user_posts]

    liked_post_uris = [like.uri for like in user_likes]
    liked_posts = Post.select().where(Post.uri.in_(liked_post_uris))
    liked_post_embeddings = [json.loads(post.embedding) for post in liked_posts]

    user_embeddings = user_post_embeddings + liked_post_embeddings

    if not user_embeddings:
        return {'cursor': CURSOR_EOF, 'feed': []}

    # Find similar posts
    all_posts = Post.select().where(Post.author != requester_did)

    scored_posts = []
    for post in all_posts:
        post_embedding = json.loads(post.embedding)
        max_similarity = 0
        for user_embedding in user_embeddings:
            similarity = cosine_similarity(post_embedding, user_embedding)
            if similarity > max_similarity:
                max_similarity = similarity
        scored_posts.append((
            post,
            max_similarity
        ))

    # Sort by similarity score
    scored_posts.sort(key=lambda x: x[1], reverse=True)

    # Simple pagination
    if cursor and cursor != CURSOR_EOF:
        cursor_parts = cursor.split('::')
        if len(cursor_parts) != 2:
            raise ValueError('Malformed cursor')

        indexed_at, cid = cursor_parts
        indexed_at = datetime.fromtimestamp(int(indexed_at) / 1000)
        # Not a real pagination, just slicing the list
        offset = 0
        for i, (post, score) in enumerate(scored_posts):
            if post.indexed_at == indexed_at and post.cid == cid:
                offset = i + 1
                break
        scored_posts = scored_posts[offset:]

    feed = [{'post': post.uri} for post, score in scored_posts[:limit]]

    cursor = CURSOR_EOF
    if feed:
        last_post = scored_posts[len(feed) - 1][0]
        cursor = f'{int(last_post.indexed_at.timestamp() * 1000)}::{last_post.cid}'

    return {
        'cursor': cursor,
        'feed': feed
    }
