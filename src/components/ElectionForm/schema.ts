import * as z from "zod";

// Shared field-level validation for the election create and edit forms so the
// same entity is validated by the same rules in both places. (Previously the
// create form required title >= 3 / description >= 10 with no max, while the
// edit form required >= 1 with max lengths — divergent rules for one entity.)
export const electionFieldSchemas = {
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(100, "Title too long"),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(500, "Description too long"),
  option1: z
    .string()
    .min(1, "Option 1 is required")
    .max(50, "Option 1 too long"),
  option2: z
    .string()
    .min(1, "Option 2 is required")
    .max(50, "Option 2 too long"),
};
