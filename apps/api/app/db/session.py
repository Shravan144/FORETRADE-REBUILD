import os
from collections.abc import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
DATABASE_URL=os.getenv("DATABASE_URL","sqlite:///./foretrade.db")
engine=create_engine(DATABASE_URL)
SessionLocal=sessionmaker(bind=engine, autoflush=False, autocommit=False)
def get_db() -> Generator[Session, None, None]:
    with SessionLocal() as session: yield session
