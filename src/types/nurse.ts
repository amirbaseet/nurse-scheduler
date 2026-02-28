import type {
  NurseProfile,
  User,
  NurseBlockedClinic,
  FixedAssignment,
  Clinic,
} from "@prisma/client";

/**
 * NurseProfile with eagerly-loaded relations.
 * Matches the shape from: db.nurseProfile.findMany({ include: { user, blockedClinics: { include: { clinic } }, fixedAssignments: { include: { clinic } } } })
 */
export type NurseWithRelations = NurseProfile & {
  user: Pick<User, "id" | "name" | "nameAr" | "isActive">;
  blockedClinics: Array<NurseBlockedClinic & { clinic: Pick<Clinic, "id" | "name"> }>;
  fixedAssignments: Array<FixedAssignment & { clinic: Pick<Clinic, "id" | "name"> }>;
};

/**
 * Serialized version for passing from server → client components.
 * Dates become ISO strings.
 */
export type SerializedNurse = Omit<NurseWithRelations, "fixedAssignments"> & {
  fixedAssignments: Array<
    Omit<FixedAssignment, "weekStart"> & {
      clinic: Pick<Clinic, "id" | "name">;
      weekStart: string;
    }
  >;
};
