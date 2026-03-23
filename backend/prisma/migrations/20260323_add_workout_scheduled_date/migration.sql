ALTER TABLE "Workout"
ADD COLUMN "scheduledDate" DATE;

CREATE INDEX "Workout_scheduledDate_idx" ON "Workout"("scheduledDate");
