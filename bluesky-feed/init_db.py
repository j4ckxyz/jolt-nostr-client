from server.database import db, Whitelist

WHITELISTED_DIDS = [
    'did:plc:4hawmtgzjx3vclfyphbhfn7v',
]

def init_db():
    if not db.is_closed():
        db.close()
    db.connect()
    db.create_tables([Whitelist])
    for did in WHITELISTED_DIDS:
        Whitelist.get_or_create(did=did)
    db.close()

if __name__ == '__main__':
    init_db()
