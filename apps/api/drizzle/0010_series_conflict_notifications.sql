ALTER TABLE "notifications" ALTER COLUMN "booking_id" DROP NOT NULL;
ALTER TABLE "notifications" ADD COLUMN "message" text;
