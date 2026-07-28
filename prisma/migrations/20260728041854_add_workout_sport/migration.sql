-- CreateEnum
CREATE TYPE "WorkoutSport" AS ENUM ('RUN', 'TRAIL_RUN', 'BIKE', 'SWIM', 'STRENGTH', 'MOBILITY', 'OTHER');

-- AlterTable
ALTER TABLE "ScheduledWorkout" ADD COLUMN     "sport" "WorkoutSport" NOT NULL DEFAULT 'RUN';

-- AlterTable
ALTER TABLE "WorkoutTemplate" ADD COLUMN     "sport" "WorkoutSport" NOT NULL DEFAULT 'RUN';
