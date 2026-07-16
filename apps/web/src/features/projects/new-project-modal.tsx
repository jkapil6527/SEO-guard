'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from '@/lib/api';
import { slugify } from '@/lib/slug';
import { zodResolver } from '@/lib/zod-resolver';
import { useCreateProject } from '@/features/projects/api';
import { Modal } from '@/components/modal';
import {
  FieldError,
  FormError,
  inputClasses,
  labelClasses,
  primaryButtonClasses,
  secondaryButtonClasses,
} from '@/components/form';
import { IconSpinner } from '@/components/icons';

const projectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters'),
  slug: z
    .string()
    .trim()
    .min(2, 'Slug must be at least 2 characters')
    .max(50, 'Slug must be at most 50 characters')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens only'),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

interface NewProjectModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewProjectModal({ open, onClose }: NewProjectModalProps) {
  const router = useRouter();
  const createProject = useCreateProject();
  const [formError, setFormError] = useState<string | null>(null);
  const [slugEdited, setSlugEdited] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: { name: '', slug: '' },
  });

  const name = watch('name');

  // Keep the slug in sync with the name until the user edits it manually.
  useEffect(() => {
    if (open && !slugEdited) {
      setValue('slug', slugify(name), { shouldValidate: false });
    }
  }, [open, name, slugEdited, setValue]);

  const close = () => {
    reset();
    setSlugEdited(false);
    setFormError(null);
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const project = await createProject.mutateAsync(values);
      close();
      router.push(`/projects/${project.slug}`);
    } catch (error) {
      if (error instanceof ApiError) {
        let handledAsFieldError = false;
        for (const fieldError of error.fieldErrors) {
          if (fieldError.field === 'name' || fieldError.field === 'slug') {
            setError(fieldError.field, { message: fieldError.message });
            handledAsFieldError = true;
          }
        }
        if (!handledAsFieldError) {
          setFormError(error.message);
        }
      } else {
        setFormError('Unable to reach the server. Please try again.');
      }
    }
  });

  return (
    <Modal open={open} onClose={close} title="New project">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormError message={formError} />
        <div>
          <label htmlFor="project-name" className={labelClasses}>
            Name
          </label>
          <input
            id="project-name"
            type="text"
            placeholder="CarDekho"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? 'project-name-error' : undefined}
            className={inputClasses}
            {...register('name')}
          />
          <FieldError id="project-name-error" message={errors.name?.message} />
        </div>
        <div>
          <label htmlFor="project-slug" className={labelClasses}>
            Slug
          </label>
          <input
            id="project-slug"
            type="text"
            placeholder="cardekho"
            aria-invalid={errors.slug ? true : undefined}
            aria-describedby={errors.slug ? 'project-slug-error' : 'project-slug-hint'}
            className={`${inputClasses} font-mono`}
            {...register('slug', { onChange: () => setSlugEdited(true) })}
          />
          <FieldError id="project-slug-error" message={errors.slug?.message} />
          {!errors.slug && (
            <p id="project-slug-hint" className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              Used in URLs — generated from the name, editable.
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={close} className={secondaryButtonClasses}>
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting} className={primaryButtonClasses}>
            {isSubmitting && <IconSpinner className="h-4 w-4" />}
            {isSubmitting ? 'Creating…' : 'Create project'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
