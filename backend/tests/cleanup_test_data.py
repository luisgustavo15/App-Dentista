# Cleanup helper: removes TEST_ procedures and their appointments created by test runs
import os
import asyncio
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).parent.parent / ".env")


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    svcs = await db.services.find({"name": {"$regex": "^TEST_"}}, {"_id": 0, "id": 1}).to_list(1000)
    ids = [s["id"] for s in svcs]
    a = await db.appointments.delete_many({"service_id": {"$in": ids}})
    s = await db.services.delete_many({"id": {"$in": ids}})
    print(f"deleted services={s.deleted_count} appointments={a.deleted_count}")


asyncio.run(main())
