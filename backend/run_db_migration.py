import sqlite3
import os

db_path = r"C:/Users/vatsa/campusgpt_sql_app.db"

def run_migration():
    print(f"Running database migration on: {db_path}")
    if not os.path.exists(db_path):
        print("Database file does not exist yet. It will be initialized on first run.")
        return
        
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check if 'reasoning' column already exists in 'chat_messages' table
    cursor.execute("PRAGMA table_info(chat_messages)")
    columns = [col[1] for col in cursor.fetchall()]
    
    if "reasoning" not in columns:
        print("Column 'reasoning' not found in 'chat_messages'. Adding column...")
        cursor.execute("ALTER TABLE chat_messages ADD COLUMN reasoning TEXT")
        conn.commit()
        print("Column 'reasoning' added successfully.")
    else:
        print("Column 'reasoning' already exists in 'chat_messages'. No changes needed.")
        
    conn.close()
    print("Database migration completed.")

if __name__ == "__main__":
    run_migration()
