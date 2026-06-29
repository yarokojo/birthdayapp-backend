import json
import bcrypt

# Load data
with open('data.json', 'r') as f:
    data = json.load(f)

# Find user and set password hash
for user in data['users']:
    if user['email'] == 'test@example.com':
        # Hash the password
        hashed = bcrypt.hashpw('password123'.encode('utf-8'), bcrypt.gensalt(10))
        user['password_hash'] = hashed.decode('utf-8')
        print(f"✅ Updated password for: {user['name']}")
        print(f"📝 New hash: {user['password_hash']}")

# Save data
with open('data.json', 'w') as f:
    json.dump(data, f, indent=2)

print("✅ data.json updated!")
