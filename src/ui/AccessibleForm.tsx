'use client'

import { forwardRef, ReactNode, useId } from 'react'
import { cn } from '@/lib/utils'
import { announceToScreenReader } from '@/lib/accessibility'

// Accessible form field wrapper
interface AccessibleFormFieldProps {
  children: ReactNode
  label: string
  description?: string
  error?: string
  required?: boolean
  className?: string
  id?: string
}

export function AccessibleFormField({
  children,
  label,
  description,
  error,
  required = false,
  className,
  id: providedId,
}: AccessibleFormFieldProps) {
  const generatedId = useId()
  const fieldId = providedId || generatedId
  const descriptionId = `${fieldId}-description`
  const errorId = `${fieldId}-error`

  return (
    <div className={cn('space-y-2', className)}>
      <label
        htmlFor={fieldId}
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        {label}
        {required && (
          <span className="text-destructive ml-1" aria-label="required">
            *
          </span>
        )}
      </label>

      {description && (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      )}

      <div className="relative">{children}</div>

      {error && (
        <p
          id={errorId}
          className="text-sm text-destructive"
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}
    </div>
  )
}

// Accessible input component
interface AccessibleInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  description?: string
  error?: string
  required?: boolean
  announceOnChange?: boolean
  announceMessage?: string
}

export const AccessibleInput = forwardRef<
  HTMLInputElement,
  AccessibleInputProps
>(
  (
    {
      label,
      description,
      error,
      required = false,
      announceOnChange = false,
      announceMessage,
      className,
      onChange,
      ...props
    },
    ref
  ) => {
    const id = useId()
    const descriptionId = `${id}-description`
    const errorId = `${id}-error`

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (announceOnChange && announceMessage) {
        announceToScreenReader(announceMessage)
      }
      onChange?.(e)
    }

    const input = (
      <input
        ref={ref}
        id={id}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-destructive focus-visible:ring-destructive',
          className
        )}
        aria-describedby={cn(description && descriptionId, error && errorId)}
        aria-invalid={error ? 'true' : 'false'}
        aria-required={required}
        onChange={handleChange}
        {...props}
      />
    )

    if (label) {
      return (
        <AccessibleFormField
          label={label}
          description={description}
          error={error}
          required={required}
          id={id}
        >
          {input}
        </AccessibleFormField>
      )
    }

    return input
  }
)

AccessibleInput.displayName = 'AccessibleInput'

// Accessible textarea component
interface AccessibleTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  description?: string
  error?: string
  required?: boolean
  announceOnChange?: boolean
  announceMessage?: string
}

export const AccessibleTextarea = forwardRef<
  HTMLTextAreaElement,
  AccessibleTextareaProps
>(
  (
    {
      label,
      description,
      error,
      required = false,
      announceOnChange = false,
      announceMessage,
      className,
      onChange,
      ...props
    },
    ref
  ) => {
    const id = useId()
    const descriptionId = `${id}-description`
    const errorId = `${id}-error`

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (announceOnChange && announceMessage) {
        announceToScreenReader(announceMessage)
      }
      onChange?.(e)
    }

    const textarea = (
      <textarea
        ref={ref}
        id={id}
        className={cn(
          'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-destructive focus-visible:ring-destructive',
          className
        )}
        aria-describedby={cn(description && descriptionId, error && errorId)}
        aria-invalid={error ? 'true' : 'false'}
        aria-required={required}
        onChange={handleChange}
        {...props}
      />
    )

    if (label) {
      return (
        <AccessibleFormField
          label={label}
          description={description}
          error={error}
          required={required}
          id={id}
        >
          {textarea}
        </AccessibleFormField>
      )
    }

    return textarea
  }
)

AccessibleTextarea.displayName = 'AccessibleTextarea'

// Accessible select component
interface AccessibleSelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  description?: string
  error?: string
  required?: boolean
  options: Array<{ value: string; label: string; disabled?: boolean }>
  placeholder?: string
  announceOnChange?: boolean
  announceMessage?: string
}

export const AccessibleSelect = forwardRef<
  HTMLSelectElement,
  AccessibleSelectProps
>(
  (
    {
      label,
      description,
      error,
      required = false,
      options,
      placeholder,
      announceOnChange = false,
      announceMessage,
      className,
      onChange,
      ...props
    },
    ref
  ) => {
    const id = useId()
    const descriptionId = `${id}-description`
    const errorId = `${id}-error`

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (announceOnChange && announceMessage) {
        announceToScreenReader(announceMessage)
      }
      onChange?.(e)
    }

    const select = (
      <select
        ref={ref}
        id={id}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-destructive focus-visible:ring-destructive',
          className
        )}
        aria-describedby={cn(description && descriptionId, error && errorId)}
        aria-invalid={error ? 'true' : 'false'}
        aria-required={required}
        onChange={handleChange}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
    )

    if (label) {
      return (
        <AccessibleFormField
          label={label}
          description={description}
          error={error}
          required={required}
          id={id}
        >
          {select}
        </AccessibleFormField>
      )
    }

    return select
  }
)

AccessibleSelect.displayName = 'AccessibleSelect'

// Accessible checkbox component
interface AccessibleCheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  description?: string
  error?: string
  required?: boolean
  announceOnChange?: boolean
  announceMessage?: string
}

export const AccessibleCheckbox = forwardRef<
  HTMLInputElement,
  AccessibleCheckboxProps
>(
  (
    {
      label,
      description,
      error,
      required = false,
      announceOnChange = false,
      announceMessage,
      className,
      onChange,
      ...props
    },
    ref
  ) => {
    const id = useId()
    const descriptionId = `${id}-description`
    const errorId = `${id}-error`

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (announceOnChange && announceMessage) {
        announceToScreenReader(announceMessage)
      }
      onChange?.(e)
    }

    const checkbox = (
      <div className="flex items-center space-x-2">
        <input
          ref={ref}
          id={id}
          type="checkbox"
          className={cn(
            'h-4 w-4 rounded border border-input ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-destructive focus-visible:ring-destructive',
            className
          )}
          aria-describedby={cn(description && descriptionId, error && errorId)}
          aria-invalid={error ? 'true' : 'false'}
          aria-required={required}
          onChange={handleChange}
          {...props}
        />
        {label && (
          <label
            htmlFor={id}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {label}
            {required && (
              <span className="text-destructive ml-1" aria-label="required">
                *
              </span>
            )}
          </label>
        )}
      </div>
    )

    if (description || error) {
      return (
        <div className="space-y-2">
          {checkbox}
          {description && (
            <p id={descriptionId} className="text-sm text-muted-foreground">
              {description}
            </p>
          )}
          {error && (
            <p
              id={errorId}
              className="text-sm text-destructive"
              role="alert"
              aria-live="polite"
            >
              {error}
            </p>
          )}
        </div>
      )
    }

    return checkbox
  }
)

AccessibleCheckbox.displayName = 'AccessibleCheckbox'

// Accessible radio group component
interface AccessibleRadioGroupProps {
  label: string
  description?: string
  error?: string
  required?: boolean
  options: Array<{ value: string; label: string; disabled?: boolean }>
  value?: string
  onChange?: (value: string) => void
  className?: string
  announceOnChange?: boolean
  announceMessage?: string
}

export function AccessibleRadioGroup({
  label,
  description,
  error,
  required = false,
  options,
  value,
  onChange,
  className,
  announceOnChange = false,
  announceMessage,
}: AccessibleRadioGroupProps) {
  const groupId = useId()
  const descriptionId = `${groupId}-description`
  const errorId = `${groupId}-error`

  const handleChange = (selectedValue: string) => {
    if (announceOnChange && announceMessage) {
      announceToScreenReader(announceMessage)
    }
    onChange?.(selectedValue)
  }

  return (
    <fieldset className={cn('space-y-3', className)}>
      <legend className="text-sm font-medium leading-none">
        {label}
        {required && (
          <span className="text-destructive ml-1" aria-label="required">
            *
          </span>
        )}
      </legend>

      {description && (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      )}

      <div
        className="space-y-2"
        role="radiogroup"
        aria-describedby={cn(description && descriptionId, error && errorId)}
        aria-invalid={error ? 'true' : 'false'}
        aria-required={required}
      >
        {options.map((option) => {
          const optionId = `${groupId}-${option.value}`
          return (
            <div key={option.value} className="flex items-center space-x-2">
              <input
                id={optionId}
                type="radio"
                name={groupId}
                value={option.value}
                checked={value === option.value}
                disabled={option.disabled}
                onChange={() => handleChange(option.value)}
                className="h-4 w-4 border border-input ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <label
                htmlFor={optionId}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {option.label}
              </label>
            </div>
          )
        })}
      </div>

      {error && (
        <p
          id={errorId}
          className="text-sm text-destructive"
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}
    </fieldset>
  )
}

// Accessible form component
interface AccessibleFormProps
  extends React.FormHTMLAttributes<HTMLFormElement> {
  onSubmit: (data: FormData) => void | Promise<void>
  announceOnSubmit?: boolean
  announceMessage?: string
}

export const AccessibleForm = forwardRef<HTMLFormElement, AccessibleFormProps>(
  (
    {
      children,
      onSubmit,
      announceOnSubmit = false,
      announceMessage,
      className,
      ...props
    },
    ref
  ) => {
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()

      if (announceOnSubmit && announceMessage) {
        announceToScreenReader(announceMessage)
      }

      const formData = new FormData(e.currentTarget)
      await onSubmit(formData)
    }

    return (
      <form
        ref={ref}
        onSubmit={handleSubmit}
        className={cn('space-y-6', className)}
        noValidate
        {...props}
      >
        {children}
      </form>
    )
  }
)

AccessibleForm.displayName = 'AccessibleForm'
