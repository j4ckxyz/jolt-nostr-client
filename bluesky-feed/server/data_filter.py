import datetime
import json

from collections import defaultdict

from atproto import models, Client

from server import config
from server.logger import logger
from server.database import db, Post, Whitelist, Like
from embedding_service import get_embedding


def get_atproto_client() -> Client:
    client = Client(base_url=config.PDS_URL)
    client.login(config.HANDLE, config.PASSWORD)
    return client


def is_archive_post(record: 'models.AppBskyFeedPost.Record') -> bool:
    # Sometimes users will import old posts from Twitter/X which con flood a feed with
    # old posts. Unfortunately, the only way to test for this is to look an old
    # created_at date. However, there are other reasons why a post might have an old
    # date, such as firehose or firehose consumer outages. It is up to you, the feed
    # creator to weigh the pros and cons, amd and optionally include this function in
    # your filter conditions, and adjust the threshold to your liking.
    #
    # See https://github.com/MarshalX/bluesky-feed-generator/pull/21

    archived_threshold = datetime.timedelta(days=1)
    created_at = datetime.datetime.fromisoformat(record.created_at)
    now = datetime.datetime.now(datetime.UTC)

    return now - created_at > archived_threshold


def should_ignore_post(created_post: dict) -> bool:
    record = created_post['record']
    uri = created_post['uri']

    if config.IGNORE_ARCHIVED_POSTS and is_archive_post(record):
        logger.debug(f'Ignoring archived post: {uri}')
        return True

    if config.IGNORE_REPLY_POSTS and record.reply:
        logger.debug(f'Ignoring reply post: {uri}')
        return True

    return False


def process_posts(posts: list) -> None:
    posts_to_create = []
    for post in posts:
        author_did = post['author']
        if not Whitelist.select().where(Whitelist.did == author_did).exists():
            continue

        if should_ignore_post(post):
            continue

        record = post['record']
        text = record.text
        embedding = get_embedding(text)

        reply_root = reply_parent = None
        if record.reply:
            reply_root = record.reply.root.uri
            reply_parent = record.reply.parent.uri

        post_dict = {
            'uri': post['uri'],
            'cid': post['cid'],
            'author': author_did,
            'text': text,
            'embedding': json.dumps(embedding),
            'reply_parent': reply_parent,
            'reply_root': reply_root,
        }
        posts_to_create.append(post_dict)

    if posts_to_create:
        with db.atomic():
            for post_dict in posts_to_create:
                Post.create(**post_dict)
        logger.debug(f'Added {len(posts_to_create)} posts')


def process_likes(likes: list) -> None:
    likes_to_create = []
    for like in likes:
        author_did = like['author']
        if not Whitelist.select().where(Whitelist.did == author_did).exists():
            continue

        like_dict = {
            'uri': like['uri'],
            'cid': like['cid'],
            'author': author_did,
        }
        likes_to_create.append(like_dict)

    if likes_to_create:
        with db.atomic():
            for like_dict in likes_to_create:
                Like.create(**like_dict)
        logger.debug(f'Added {len(likes_to_create)} likes')


def operations_callback(ops: defaultdict) -> None:
    process_posts(ops[models.ids.AppBskyFeedPost]['created'])
    process_likes(ops[models.ids.AppBskyFeedLike]['created'])

    posts_to_delete = ops[models.ids.AppBskyFeedPost]['deleted']
    if posts_to_delete:
        post_uris_to_delete = [post['uri'] for post in posts_to_delete]
        Post.delete().where(Post.uri.in_(post_uris_to_delete)).execute()
        logger.debug(f'Deleted posts: {len(post_uris_to_delete)}')

    likes_to_delete = ops[models.ids.AppBskyFeedLike]['deleted']
    if likes_to_delete:
        like_uris_to_delete = [like['uri'] for like in likes_to_delete]
        Like.delete().where(Like.uri.in_(like_uris_to_delete)).execute()
        logger.debug(f'Deleted likes: {len(like_uris_to_delete)}')