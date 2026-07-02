"""Terminal chat for testing the agent without any frontend.

Usage (from backend/ with venv active):
    python chat_cli.py

Type a message, get a reply. Type 'quit' to exit.
Optionally set birth details for the session with:
    /birth 1998-03-14 08:45 Jaipur, India
"""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

if not os.getenv("GROQ_API_KEY"):
    raise SystemExit("GROQ_API_KEY missing — create .env from .env.example first (free key at console.groq.com).")

from app.graph import build_graph

agent = build_graph()
config = {"configurable": {"thread_id": "cli-session"}}
birth_details = None

print("AstroAgent CLI — type 'quit' to exit.")
print("Set birth details: /birth YYYY-MM-DD HH:MM Place, Country\n")

while True:
    try:
        user_input = input("you > ").strip()
    except (KeyboardInterrupt, EOFError):
        print("\nbye")
        break

    if not user_input:
        continue
    if user_input.lower() in ("quit", "exit"):
        break

    if user_input.startswith("/birth "):
        try:
            parts = user_input[len("/birth "):].split(" ", 2)
            birth_details = {"date": parts[0], "time": parts[1], "place": parts[2]}
            print(f"[birth details set: {birth_details}]\n")
        except IndexError:
            print("[format: /birth YYYY-MM-DD HH:MM Place, Country]\n")
        continue

    state_update = {"messages": [{"role": "user", "content": user_input}]}
    if birth_details:
        state_update["birth_details"] = birth_details

    try:
        result = agent.invoke(state_update, config)
        print(f"\nastro > {result['messages'][-1].content}\n")
    except Exception as e:
        print(f"\n[error: {e}]\n")
