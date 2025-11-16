import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../service/api";
import { message } from "antd";
import { queryKeys } from "./useQueries";

// Helper to create mutation with query invalidation
const createMutationHook = (mutationFn, defaultOptions = {}) => {
  return (options = {}) => {
    const queryClient = useQueryClient();
    const {
      onSuccess,
      onError,
      successMessage,
      errorMessage,
      invalidateQueries = [],
      showSuccessMessage = true,
      showErrorMessage = true,
    } = { ...defaultOptions, ...options };

    return useMutation({
      mutationFn,
      onSuccess: (data, variables, context) => {
        if (showSuccessMessage && successMessage) {
          message.success(successMessage);
        }
        
        // Invalidate queries to refetch data
        invalidateQueries.forEach((key) => {
          // If key is a function, call it; otherwise use as-is
          // For queries with params, invalidate all matching queries
          if (typeof key === 'function') {
            // Invalidate all queries that start with the base key
            const baseKey = key();
            if (Array.isArray(baseKey) && baseKey.length > 0) {
              queryClient.invalidateQueries({ queryKey: [baseKey[0]] });
            } else {
              queryClient.invalidateQueries({ queryKey: baseKey });
            }
          } else if (Array.isArray(key) && key.length > 0) {
            // Invalidate all queries that start with the base key (e.g., ["dailyEntries"])
            queryClient.invalidateQueries({ queryKey: [key[0]] });
          } else {
            queryClient.invalidateQueries({ queryKey: key });
          }
        });
        
        if (onSuccess) {
          onSuccess(data, variables, context);
        }
      },
      onError: (error, variables, context) => {
        const errorMsg = error?.response?.data?.message || 
                        error?.message || 
                        errorMessage || 
                        'An error occurred';
        
        if (showErrorMessage) {
          message.error(errorMsg);
        }
        
        if (onError) {
          onError(error, variables, context);
        }
      },
    });
  };
};

// Daily Entry Mutations
export const useCreateDailyEntry = createMutationHook(
  async (payload) => {
    const res = await api.post("/api/dailyEntries", payload);
    return res.data;
  },
  {
    successMessage: "Daily entry saved successfully",
    invalidateQueries: [["dailyEntries"], ["vehicles"], ["compressors"]], // Invalidate all matching queries
  }
);

export const useUpdateDailyEntry = createMutationHook(
  async ({ id, ...payload }) => {
    const res = await api.put(`/api/dailyEntries/${id}`, payload);
    return res.data;
  },
  {
    successMessage: "Daily entry updated successfully",
    invalidateQueries: [queryKeys.dailyEntries()],
  }
);

export const useDeleteDailyEntry = createMutationHook(
  async (id) => {
    const res = await api.delete(`/api/dailyEntries/${id}`, { data: {} });
    return res.data;
  },
  {
    successMessage: "Daily entry deleted successfully",
    invalidateQueries: [["dailyEntries"]], // Invalidate all dailyEntries queries regardless of params
  }
);

// Item Mutations
export const useCreateItem = createMutationHook(
  async (payload) => {
    const res = await api.post("/api/items", payload);
    return res.data;
  },
  {
    successMessage: "Item created successfully",
    invalidateQueries: [queryKeys.items(), queryKeys.availableItems()],
  }
);

export const useUpdateItem = createMutationHook(
  async ({ id, ...payload }) => {
    const res = await api.put(`/api/items/${id}`, payload);
    return res.data;
  },
  {
    successMessage: "Item updated successfully",
    invalidateQueries: [queryKeys.items(), queryKeys.availableItems()],
  }
);

export const useDeleteItem = createMutationHook(
  async (id) => {
    const res = await api.delete(`/api/items/${id}`);
    return res.data;
  },
  {
    successMessage: "Item deleted successfully",
    invalidateQueries: [queryKeys.items(), queryKeys.availableItems()],
  }
);

// Vehicle/Machine Mutations
export const useCreateVehicle = createMutationHook(
  async (payload) => {
    const res = await api.post("/api/vehicles", payload);
    return res.data;
  },
  {
    successMessage: "Vehicle created successfully",
    invalidateQueries: [queryKeys.vehicles()],
  }
);

export const useUpdateVehicle = createMutationHook(
  async ({ id, ...payload }) => {
    const res = await api.put(`/api/vehicles/${id}`, payload);
    return res.data;
  },
  {
    successMessage: "Vehicle updated successfully",
    invalidateQueries: [queryKeys.vehicles()],
  }
);

export const useDeleteVehicle = createMutationHook(
  async (id) => {
    const res = await api.delete(`/api/vehicles/${id}`);
    return res.data;
  },
  {
    successMessage: "Vehicle deleted successfully",
    invalidateQueries: [queryKeys.vehicles()],
  }
);

// Compressor Mutations
export const useCreateCompressor = createMutationHook(
  async (payload) => {
    const res = await api.post("/api/compressors", payload);
    return res.data;
  },
  {
    successMessage: "Compressor created successfully",
    invalidateQueries: [queryKeys.compressors()],
  }
);

export const useUpdateCompressor = createMutationHook(
  async ({ id, ...payload }) => {
    const res = await api.put(`/api/compressors/${id}`, payload);
    return res.data;
  },
  {
    successMessage: "Compressor updated successfully",
    invalidateQueries: [queryKeys.compressors()],
  }
);

export const useDeleteCompressor = createMutationHook(
  async (id) => {
    const res = await api.delete(`/api/compressors/${id}`);
    return res.data;
  },
  {
    successMessage: "Compressor deleted successfully",
    invalidateQueries: [queryKeys.compressors()],
  }
);

// ItemService Mutations
export const useFitItem = createMutationHook(
  async (payload) => {
    const res = await api.post("/api/itemServices/fit", payload);
    return res.data;
  },
  {
    successMessage: "Item fitted successfully",
    invalidateQueries: [["fittedItems"], ["items"], ["itemsByType"]],
  }
);

export const useRemoveItem = createMutationHook(
  async ({ id, ...payload }) => {
    const res = await api.put(`/api/itemServices/${id}/remove`, payload);
    return res.data;
  },
  {
    successMessage: "Item removed successfully",
    invalidateQueries: [["fittedItems"], ["serviceUsageReport"]],
  }
);

export const useInitializeMonth = createMutationHook(
  async () => {
    const res = await api.post("/api/items/initialize-month");
    return res.data;
  },
  {
    successMessage: "Month initialized successfully",
    invalidateQueries: [["items"], ["inventoryReport"]],
  }
);

// Site Mutations
export const useCreateSite = createMutationHook(
  async (payload) => {
    const res = await api.post("/api/sites", payload);
    return res.data;
  },
  {
    successMessage: "Site created successfully",
    invalidateQueries: [queryKeys.sites()],
  }
);

export const useUpdateSite = createMutationHook(
  async ({ id, ...payload }) => {
    const res = await api.put(`/api/sites/${id}`, payload);
    return res.data;
  },
  {
    successMessage: "Site updated successfully",
    invalidateQueries: [queryKeys.sites()],
  }
);

export const useDeleteSite = createMutationHook(
  async (id) => {
    const res = await api.delete(`/api/sites/${id}`);
    return res.data;
  },
  {
    successMessage: "Site deleted successfully",
    invalidateQueries: [queryKeys.sites()],
  }
);

// Employee Mutations
export const useCreateEmployee = createMutationHook(
  async (payload) => {
    const res = await api.post("/api/employeeLists", payload);
    return res.data;
  },
  {
    successMessage: "Employee created successfully",
    invalidateQueries: [queryKeys.employees()],
  }
);

export const useUpdateEmployee = createMutationHook(
  async ({ id, ...payload }) => {
    const res = await api.put(`/api/employeeLists/${id}`, payload);
    return res.data;
  },
  {
    successMessage: "Employee updated successfully",
    invalidateQueries: [queryKeys.employees(), queryKeys.employeeDetails()],
  }
);

export const useDeleteEmployee = createMutationHook(
  async (id) => {
    const res = await api.delete(`/api/employeeLists/${id}`);
    return res.data;
  },
  {
    successMessage: "Employee deleted successfully",
    invalidateQueries: [queryKeys.employees()],
  }
);

// Brand Mutations
export const useCreateBrand = createMutationHook(
  async (payload) => {
    const res = await api.post("/api/brands", payload);
    return res.data;
  },
  {
    successMessage: "Brand created successfully",
    invalidateQueries: [queryKeys.brands()],
  }
);

export const useUpdateBrand = createMutationHook(
  async ({ id, ...payload }) => {
    const res = await api.put(`/api/brands/${id}`, payload);
    return res.data;
  },
  {
    successMessage: "Brand updated successfully",
    invalidateQueries: [queryKeys.brands()],
  }
);

export const useDeleteBrand = createMutationHook(
  async (id) => {
    const res = await api.delete(`/api/brands/${id}`);
    return res.data;
  },
  {
    successMessage: "Brand deleted successfully",
    invalidateQueries: [queryKeys.brands()],
  }
);

// Supplier Mutations
export const useCreateSupplier = createMutationHook(
  async (payload) => {
    const res = await api.post("/api/suppliers", payload);
    return res.data;
  },
  {
    successMessage: "Supplier created successfully",
    invalidateQueries: [queryKeys.suppliers()],
  }
);

export const useUpdateSupplier = createMutationHook(
  async ({ id, ...payload }) => {
    const res = await api.put(`/api/suppliers/${id}`, payload);
    return res.data;
  },
  {
    successMessage: "Supplier updated successfully",
    invalidateQueries: [queryKeys.suppliers()],
  }
);

export const useDeleteSupplier = createMutationHook(
  async (id) => {
    const res = await api.delete(`/api/suppliers/${id}`);
    return res.data;
  },
  {
    successMessage: "Supplier deleted successfully",
    invalidateQueries: [queryKeys.suppliers()],
  }
);

