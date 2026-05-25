-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mentorAttachments" JSONB,
ADD COLUMN     "mentorBio" TEXT,
ADD COLUMN     "mentorEducations" JSONB,
ADD COLUMN     "mentorExperiences" JSONB,
ADD COLUMN     "mentorJobTitle" TEXT,
ADD COLUMN     "mentorSkills" TEXT[] DEFAULT ARRAY[]::TEXT[];
