import { useQuery } from "@tanstack/react-query";
import api from "../service/api";
import { message } from "antd";

// Query keys factory
export const queryKeys = {
  sites: (params) => ["sites", params],
  vehicles: (params) => ["vehicles", params],
  machines: (params) => ["machines", params], // Alias for vehicles
  compressors: (params) => ["compressors", params],
  employees: (params) => ["employees", params],
  employeeLists: (params) => ["employeeLists", params],
  items: (params) => ["items", params],
  availableItems: (params) => ["availableItems", params],
  dailyEntries: (params) => ["dailyEntries", params],
  serviceAlerts: (params) => ["serviceAlerts", params],
  services: (params) => ["services", params],
  brands: (params) => ["brands", params],
  suppliers: (params) => ["suppliers", params],
  purchaseOrders: (params) => ["purchaseOrders", params],
  addresses: (params) => ["addresses", params],
  users: (params) => ["users", params],
  dashboard: () => ["dashboard"],
  employeeDetails: (id) => ["employeeDetails", id],
  serviceHistory: (params) => ["serviceHistory", params],
};

// Sites
export const useSites = (params = { limit: 1000 }) => {
  return useQuery({
    queryKey: queryKeys.sites(params),
    queryFn: async () => {
      const queryString = new URLSearchParams(params).toString();
      const res = await api.get(`/api/sites?${queryString}`);
      return res.data.data || [];
    },
    staleTime: 10 * 60 * 1000, // Sites don't change often
  });
};

// Vehicles/Machines
export const useVehicles = (params = { limit: 1000 }) => {
  return useQuery({
    queryKey: queryKeys.vehicles(params),
    queryFn: async () => {
      const queryString = new URLSearchParams(params).toString();
      const res = await api.get(`/api/vehicles?${queryString}`);
      return res.data.data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
};

// Alias for vehicles
export const useMachines = useVehicles;

// Compressors
export const useCompressors = (params = { limit: 1000 }) => {
  return useQuery({
    queryKey: queryKeys.compressors(params),
    queryFn: async () => {
      const queryString = new URLSearchParams(params).toString();
      const res = await api.get(`/api/compressors?${queryString}`);
      return res.data.data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
};

// Employees
export const useEmployees = (params = { limit: 10000 }) => {
  return useQuery({
    queryKey: queryKeys.employees(params),
    queryFn: async () => {
      const queryString = new URLSearchParams(params).toString();
      const res = await api.get(`/api/employeeLists?${queryString}`);
      return res.data.data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
};

// Items
export const useItems = (params = {}) => {
  return useQuery({
    queryKey: queryKeys.items(params),
    queryFn: async () => {
      const queryString = new URLSearchParams(params).toString();
      const res = await api.get(`/api/items?${queryString}`);
      return {
        data: res.data.data || [],
        total: res.data.total || 0,
        page: res.data.page || 1,
        limit: res.data.limit || 10,
      };
    },
    staleTime: 2 * 60 * 1000,
  });
};

// Available items for fitting
export const useAvailableItems = (params = { limit: 1000 }) => {
  return useQuery({
    queryKey: queryKeys.availableItems(params),
    queryFn: async () => {
      const queryString = new URLSearchParams(params).toString();
      const res = await api.get(`/api/items/available-for-fitting?${queryString}`);
      return res.data.data || [];
    },
    staleTime: 1 * 60 * 1000, // Refresh more often as items get fitted
  });
};

// Daily Entries
export const useDailyEntries = (params = { page: 1, limit: 10 }) => {
  return useQuery({
    queryKey: queryKeys.dailyEntries(params),
    queryFn: async () => {
      const queryString = new URLSearchParams(params).toString();
      const res = await api.get(`/api/dailyEntries?${queryString}`);
      return {
        data: res.data.data || [],
        total: res.data.total || 0,
        page: res.data.page || 1,
        limit: res.data.limit || 10,
      };
    },
    staleTime: 1 * 60 * 1000,
  });
};

// ItemService - Get fitted items
export const useFittedItems = (vehicleId, compressorId) => {
  return useQuery({
    queryKey: ["fittedItems", { vehicleId, compressorId }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (vehicleId) params.append("vehicleId", vehicleId);
      if (compressorId) params.append("compressorId", compressorId);
      const res = await api.get(`/api/itemServices/fitted?${params.toString()}`);
      return res.data.data || [];
    },
    enabled: !!(vehicleId || compressorId),
    staleTime: 1 * 60 * 1000,
  });
};

// ItemService - Get items by type
export const useItemsByType = (itemType) => {
  return useQuery({
    queryKey: ["itemsByType", itemType],
    queryFn: async () => {
      const res = await api.get(`/api/items/by-type/${encodeURIComponent(itemType)}`);
      return res.data.data || [];
    },
    enabled: !!itemType,
    staleTime: 2 * 60 * 1000,
  });
};

// Inventory Report
export const useInventoryReport = (month, year, itemType) => {
  return useQuery({
    queryKey: ["inventoryReport", { month, year, itemType }],
    queryFn: async () => {
      const params = new URLSearchParams({ month, year });
      if (itemType) params.append("itemType", itemType);
      const res = await api.get(`/api/items/monthly-report?${params.toString()}`);
      return res.data;
    },
    enabled: !!(month && year),
    staleTime: 5 * 60 * 1000,
  });
};

// Service Usage Report
export const useServiceUsageReport = (startDate, endDate, vehicleId, compressorId) => {
  return useQuery({
    queryKey: ["serviceUsageReport", { startDate, endDate, vehicleId, compressorId }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (vehicleId) params.append("vehicleId", vehicleId);
      if (compressorId) params.append("compressorId", compressorId);
      const res = await api.get(`/api/itemServices/usage-report?${params.toString()}`);
      return res.data.data || [];
    },
    staleTime: 2 * 60 * 1000,
  });
};

// Brands
export const useBrands = (params = { limit: 1000 }) => {
  return useQuery({
    queryKey: queryKeys.brands(params),
    queryFn: async () => {
      const queryString = new URLSearchParams(params).toString();
      const res = await api.get(`/api/brands?${queryString}`);
      return res.data.data || [];
    },
    staleTime: 10 * 60 * 1000, // Brands don't change often
  });
};

// Suppliers
export const useSuppliers = (params = { limit: 1000 }) => {
  return useQuery({
    queryKey: queryKeys.suppliers(params),
    queryFn: async () => {
      const queryString = new URLSearchParams(params).toString();
      const res = await api.get(`/api/suppliers?${queryString}`);
      return res.data.data || [];
    },
    staleTime: 10 * 60 * 1000,
  });
};

// Purchase Orders
export const usePurchaseOrders = (params = {}) => {
  return useQuery({
    queryKey: queryKeys.purchaseOrders(params),
    queryFn: async () => {
      const queryString = new URLSearchParams(params).toString();
      const res = await api.get(`/api/purchaseOrders?${queryString}`);
      return {
        data: res.data.data || [],
        total: res.data.total || 0,
        page: res.data.page || 1,
        limit: res.data.limit || 10,
      };
    },
    staleTime: 2 * 60 * 1000,
  });
};

// Addresses
export const useAddresses = (params = { limit: 1000 }) => {
  return useQuery({
    queryKey: queryKeys.addresses(params),
    queryFn: async () => {
      const queryString = new URLSearchParams(params).toString();
      const res = await api.get(`/api/addresses?${queryString}`);
      return res.data.data || [];
    },
    staleTime: 10 * 60 * 1000,
  });
};

// Users
export const useUsers = (params = {}) => {
  return useQuery({
    queryKey: queryKeys.users(params),
    queryFn: async () => {
      const queryString = new URLSearchParams(params).toString();
      const res = await api.get(`/api/users?${queryString}`);
      return {
        data: res.data.data || [],
        total: res.data.total || 0,
        page: res.data.page || 1,
        limit: res.data.limit || 10,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
};

// Dashboard Stats
export const useDashboard = () => {
  return useQuery({
    queryKey: queryKeys.dashboard(),
    queryFn: async () => {
      const res = await api.get("/api/dashboard");
      return res.data.data || {};
    },
    staleTime: 2 * 60 * 1000,
  });
};

// Employee Details
export const useEmployeeDetails = (id) => {
  return useQuery({
    queryKey: queryKeys.employeeDetails(id),
    queryFn: async () => {
      try {
        // Try history endpoint first
        const res = await api.get(`/api/employeeLists/${id}/history`);
        return res.data.data;
      } catch (err) {
        if (err?.response?.status === 404) {
          // Fallback to basic employee data
          const res = await api.get(`/api/employeeLists/${id}`);
          const emp = res.data.data;
          return {
            employee: emp,
            attendances: [],
            dailyEntries: [],
            statistics: {
              totalDaysWorked: 0,
              totalPresent: 0,
              totalAbsent: 0,
              totalSalaryPaid: 0,
              totalAdvanceTaken: emp?.advancedAmount || 0,
              currentBalance: emp?.remainingAmount || 0,
              uniqueSites: 0,
              uniqueVehicles: 0,
            },
          };
        }
        throw err;
      }
    },
    enabled: !!id, // Only run if id is provided
    staleTime: 5 * 60 * 1000,
  });
};

// Generate Ref Number
export const useGenerateRefNo = () => {
  return useQuery({
    queryKey: ["generateRefNo"],
    queryFn: async () => {
      const res = await api.get("/api/dailyEntries/generate-ref");
      return res.data.refNo;
    },
    enabled: false, // Don't auto-fetch, use refetch manually
    staleTime: 0, // Always fetch fresh
  });
};

