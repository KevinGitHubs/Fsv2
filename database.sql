CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
  id bigserial primary key,
  username varchar(50) unique not null,
  password text not null,
  name varchar(100),
  phone varchar(20),
  coins integer default 0,
  rank varchar(20) default 'nonpil',
  is_admin boolean default false,
  referral_code varchar(20),
  created_at timestamp default now()
);

CREATE TABLE products (
  id bigserial primary key,
  name varchar(100),
  price integer,
  image_url text
);

CREATE TABLE orders (
  id bigserial primary key,
  user_id bigint references users(id),
  product_id bigint references products(id),
  status varchar(20) default 'pending',
  created_at timestamp default now()
);

CREATE TABLE qr_codes (
  id bigserial primary key,
  code varchar(100) unique,
  is_active boolean default true,
  created_at timestamp default now()
);

CREATE TABLE games_history (
  id bigserial primary key,
  user_id bigint references users(id),
  game_type varchar(50),
  score integer,
  time_taken integer,
  played_at timestamp default now()
);

CREATE TABLE chat_messages (
  id bigserial primary key,
  user_id bigint references users(id),
  message text,
  is_broadcast boolean default false,
  sent_at timestamp default now()
);

CREATE TABLE streaks (
  user_id bigint primary key references users(id),
  streak integer default 0,
  last_date date
);

INSERT INTO users (username, password, name, phone, rank, is_admin, referral_code)
VALUES ('M4Eadm', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Kevin', '088218776877', 'owner', true, 'OWNER001')
ON CONFLICT DO NOTHING;

INSERT INTO products (name, price, image_url) VALUES
('Theme Pack Neon', 500, 'https://i.ibb.co/6r1vG6w/neon.png'),
('Emoji Pack Premium', 300, 'https://i.ibb.co/z5pBqyg/emoji.png');
