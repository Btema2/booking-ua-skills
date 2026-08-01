CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"floor" integer NOT NULL,
	"capacity" integer NOT NULL,
	CONSTRAINT "rooms_name_unique" UNIQUE("name")
);
