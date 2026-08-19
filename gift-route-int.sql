-- Drop and recreate gifts table with INTEGER IDs
DROP TABLE IF EXISTS gifts CASCADE;

CREATE TABLE gifts (
  id SERIAL PRIMARY KEY,
  sender_id INTEGER REFERENCES users(id),
  recipient_id INTEGER REFERENCES users(id),
  gift_id VARCHAR(255),
  gift_name VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  fee DECIMAL(10,2) DEFAULT 0,
  network VARCHAR(50),
  phone_number VARCHAR(20),
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);
