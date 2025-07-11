#!/bin/bash

# Database inspection script for Football Game Generator
export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"

echo "🗄️  Football Game Generator Database Inspection"
echo "=============================================="

echo ""
echo "📊 Database Statistics:"
echo "----------------------"
psql football_game_generator -c "SELECT COUNT(*) as total_users FROM users;"
psql football_game_generator -c "SELECT COUNT(*) as total_profiles FROM profiles;"

echo ""
echo "👥 All Users:"
echo "-------------"
psql football_game_generator -c "SELECT id, created_at FROM users ORDER BY created_at DESC;"

echo ""
echo "🏃 All Profiles:"
echo "----------------"
psql football_game_generator -c "SELECT id, user_id, first_name, last_name, nickname, self_rating, primary_position, secondary_position, created_at FROM profiles ORDER BY created_at DESC;"

echo ""
echo "🔗 Users with Profiles (Joined View):"
echo "-------------------------------------"
psql football_game_generator -c "SELECT u.id as user_id, u.created_at as user_created, p.first_name, p.last_name, p.nickname, p.self_rating, p.primary_position, p.secondary_position FROM users u LEFT JOIN profiles p ON u.id = p.user_id ORDER BY u.created_at DESC;"

echo ""
echo "📈 Profile Statistics:"
echo "---------------------"
psql football_game_generator -c "SELECT primary_position, COUNT(*) as count FROM profiles GROUP BY primary_position ORDER BY count DESC;"

echo ""
echo "🏆 Rating Distribution:"
echo "----------------------"
psql football_game_generator -c "SELECT self_rating, COUNT(*) as count FROM profiles GROUP BY self_rating ORDER BY self_rating;"

echo ""
echo "🔧 Database Schema:"
echo "==================="
echo ""
echo "Tables:"
psql football_game_generator -c "\dt"

echo ""
echo "Users table structure:"
psql football_game_generator -c "\d users"

echo ""
echo "Profiles table structure:"
psql football_game_generator -c "\d profiles" 