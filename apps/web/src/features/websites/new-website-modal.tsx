'use client';

import { useState } from 'react';
import { Modal } from '@/components/modal';
import {
  FieldError,
  FormError,
  inputClasses,
  labelClasses,
  primaryButtonClasses,
  secondaryButtonClasses,
} from '@/components/form';
import { ApiError } from '@/lib/api';
import { useCreateWebsite } from '@/features/websites/api';

export function NewWebsiteModal({
  projectId,
  open,
  onClose,
  onCreated,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onCreated: (websiteId: string) => void;
}) {
  const [name, setName] = useState('');
  const [origin, setOrigin] = useState('');
  const create = useCreateWebsite(projectId);

  const fieldErrors =
    create.error instanceof ApiError
      ? Object.fromEntries(create.error.fieldErrors.map((e) => [e.field, e.message]))
      : {};

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const website = await create.mutateAsync({ name: name.trim(), origin: origin.trim() });
      setName('');
      setOrigin('');
      onCreated(website.id);
    } catch {
      // surfaced below
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add a website">
      <form onSubmit={submit} className="space-y-4">
        {create.error && !Object.keys(fieldErrors).length && (
          <FormError message={(create.error as Error).message} />
        )}
        <div>
          <label htmlFor="w-name" className={labelClasses}>
            Name
          </label>
          <input
            id="w-name"
            className={inputClasses}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="CarDekho"
            required
          />
          <FieldError id="w-name-error" message={fieldErrors.name} />
        </div>
        <div>
          <label htmlFor="w-origin" className={labelClasses}>
            Origin
          </label>
          <input
            id="w-origin"
            className={inputClasses}
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="https://www.cardekho.com"
            required
          />
          <FieldError id="w-origin-error" message={fieldErrors.origin} />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Scheme + host only — no path, query or trailing path.
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={secondaryButtonClasses}>
            Cancel
          </button>
          <button type="submit" disabled={create.isPending} className={primaryButtonClasses}>
            {create.isPending ? 'Adding…' : 'Add website'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
