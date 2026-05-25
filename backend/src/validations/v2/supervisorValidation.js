import Joi from "joi";

export const createSupervisorSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  fullName: Joi.string().max(140).required(),
  companyName: Joi.string().max(180).required(),
  companyDescription: Joi.string().max(2000).allow("", null),
  companyLocation: Joi.string().max(140).allow("", null),
  companyWebsite: Joi.string().uri().allow("", null),
  position: Joi.string().max(140).allow("", null)
});

export const updateSupervisorSchema = Joi.object({
  fullName: Joi.string().max(140),
  position: Joi.string().max(140).allow("", null),
  companyName: Joi.string().max(180).allow("", null),
  companyDescription: Joi.string().max(2000).allow("", null),
  companyLocation: Joi.string().max(140).allow("", null),
  companyWebsite: Joi.string().uri().allow("", null)
});

export const internFeedbackSchema = Joi.object({
  comment: Joi.string().max(3000).required()
});

export const updateInternStatusSchema = Joi.object({
  status: Joi.string().valid("active", "paused", "completed").required()
});

export const createStagiaireSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Un email valide est requis",
    "any.required": "Email est obligatoire"
  }),
  fullName: Joi.string().max(140).optional().allow("", null),
  phone: Joi.string().max(20).optional().allow("", null),
  education: Joi.string().max(500).optional().allow("", null),
  skills: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).optional(),
  experience: Joi.string().max(1000).optional().allow("", null)
});

export const updateStagiaireSchema = Joi.object({
  fullName: Joi.string().max(140).optional().allow("", null),
  phone: Joi.string().max(20).optional().allow("", null),
  education: Joi.string().max(500).optional().allow("", null),
  skills: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).optional(),
  experience: Joi.string().max(1000).optional().allow("", null)
});
