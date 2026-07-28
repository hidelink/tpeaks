-- CreateTable
CREATE TABLE "TrainingGroup" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingGroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrainingGroup_teamId_name_key" ON "TrainingGroup"("teamId", "name");

-- CreateIndex
CREATE INDEX "TrainingGroupMember_membershipId_idx" ON "TrainingGroupMember"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingGroupMember_groupId_membershipId_key" ON "TrainingGroupMember"("groupId", "membershipId");

-- AddForeignKey
ALTER TABLE "TrainingGroup" ADD CONSTRAINT "TrainingGroup_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingGroupMember" ADD CONSTRAINT "TrainingGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TrainingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingGroupMember" ADD CONSTRAINT "TrainingGroupMember_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "TeamMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

