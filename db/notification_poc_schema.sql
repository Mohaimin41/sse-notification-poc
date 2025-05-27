-- Table: public.notifications

DROP TABLE IF EXISTS public.notifications;

CREATE TABLE IF NOT EXISTS public.notifications
(
    id serial,
    message text COLLATE pg_catalog."default" NOT NULL,
    channel_type text COLLATE pg_catalog."default" NOT NULL,
    is_sent boolean DEFAULT false,
    is_viewed boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    user_id integer,
    CONSTRAINT notifications_pkey PRIMARY KEY (id)
);