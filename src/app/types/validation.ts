import { z } from 'zod';

export const urlSchema = z.object({
    url: z.string().min(1, "URL is required")
});