"use client";

import { z } from 'zod';

export const courseSchema = z.object({
  title: z.string().min(3, "Judul kursus minimal 3 karakter"),
  description: z.string().min(10, "Deskripsi minimal 10 karakter"),
  instructorId: z.string().min(1, "Wajib memilih mentor"),
  price: z.coerce.number().min(0, "Harga tidak boleh negatif"),
  published: z.boolean().default(false),
  thumbnailUrl: z.string().url("URL thumbnail tidak valid").optional().or(z.literal('')),
});

export type CourseFormData = z.infer<typeof courseSchema>;
