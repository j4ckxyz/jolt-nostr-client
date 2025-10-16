# Project Overview

This project is a Bluesky feed generator that creates a custom feed for users based on their recent posts and likes. It is built using Python, Flask, and the AT Protocol SDK. The feed generator uses the Gemini API to generate embeddings for posts and then finds similar posts from other users.

## Building and Running

1.  **Install dependencies:**

    ```bash
    pip install -r requirements.txt
    ```

2.  **Set up the environment:**

    *   Copy `.env.example` to `.env`.
    *   Fill in the following variables in the `.env` file:
        *   `HOSTNAME`: The hostname where the feed generator will be hosted (e.g., `blue.j4ck.xyz`).
        *   `HANDLE`: Your Bluesky handle (e.g., `j4ck.xyz`).
        *   `PASSWORD`: Your Bluesky app password.
        *   `PDS_URL`: The URL of your Personal Data Server (PDS).

3.  **Initialize the database:**

    ```bash
    python3 init_db.py
    ```

4.  **Publish the feed:**

    ```bash
    python3 publish_feed.py
    ```

    This will output a `FEED_URI`. Copy this URI and paste it into the `.env` file.

5.  **Run the server:**

    ```bash
    waitress-serve --listen=127.0.0.1:8080 server.app:app
    ```

## Development Conventions

*   The project uses `peewee` as the ORM for interacting with the SQLite database.
*   The `data_filter.py` file contains the logic for processing data from the firehose.
*   The `algos` directory contains the feed generation algorithms.
*   The `embedding_service.py` file contains the logic for generating embeddings using the Gemini API.
