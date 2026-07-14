import { ref } from 'vue';
import { z } from 'zod';

export function useFormValidation() {
  const formErrors = ref<Record<string, string>>({});

  const validate = <T>(schema: z.ZodType<T>, data: unknown): boolean => {
    formErrors.value = {};
    const result = schema.safeParse(data);
    
    if (!result.success) {
      result.error.issues.forEach((issue) => {
        // Use the first path element as the field name
        const field = issue.path[0]?.toString();
        if (field && !formErrors.value[field]) {
          // Store the first error message for the field
          formErrors.value[field] = issue.message;
        }
      });
      return false;
    }
    
    return true;
  };

  const setApiError = (field: string, messageKey: string) => {
    formErrors.value[field] = messageKey;
  };

  const clearError = (field: string) => {
    if (formErrors.value[field]) {
      delete formErrors.value[field];
    }
  };

  const clearAllErrors = () => {
    formErrors.value = {};
  };

  return {
    formErrors,
    validate,
    setApiError,
    clearError,
    clearAllErrors
  };
}
