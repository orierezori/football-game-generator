#!/bin/bash

# Quick database console launcher
export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"

echo "🚀 Launching PostgreSQL Console for Football Game Generator"
echo "==========================================================="
echo ""
echo "Useful commands:"
echo "  \\dt          - List all tables"
echo "  \\d users     - Show users table structure"
echo "  \\d profiles  - Show profiles table structure"
echo "  \\q          - Exit console"
echo ""
echo "Example queries:"
echo "  SELECT * FROM users;"
echo "  SELECT * FROM profiles;"
echo "  SELECT COUNT(*) FROM profiles;"
echo ""
echo "Press Enter to continue..."
"user_ya29.a0AS3"
ADMIN
read
echo "UPDATE users SET role = 'ADMIN' WHERE id = (SELECT user_id FROM profiles WHERE nickname = 'King');"
psql football_game_generator 