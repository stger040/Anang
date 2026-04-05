-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "staffModuleAllowList" "ModuleKey"[] DEFAULT ARRAY[]::"ModuleKey"[];

-- AlterTable
ALTER TABLE "UserInvite" ADD COLUMN     "staffModuleAllowList" "ModuleKey"[] DEFAULT ARRAY[]::"ModuleKey"[];
