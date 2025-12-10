import { useState, useEffect, useRef, useMemo } from "react";
import {
  Button,
  Input,
  Table,
  Tag,
  Space,
  Form,
  Select,
  InputNumber,
  Switch,
  Card,
  Popconfirm,
  DatePicker,
  Alert,
  message,
  Row,
  Col,
  Typography,
  Divider,
  Radio,
  Collapse,
  Modal,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  ToolOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import api from "../service/api";
import { canEdit, canDelete, canCreate } from "../service/auth";
import dayjs from "dayjs";
import { truncateToFixed } from "../utils/textUtils";
import {
  useSites,
  useMachines,
  useCompressors,
  useEmployees,
  useDailyEntries,
  useFittedDrillingTools
} from "../hooks/useQueries";
import { useCreateDailyEntry, useUpdateDailyEntry, useDeleteDailyEntry } from "../hooks/useMutations";
import { useItemsByType } from "../hooks/useQueries";
import EditDailyEntry from "./EditDailyEntry";

const { Title, Text } = Typography;
const { Panel } = Collapse;

const DailyEntry = () => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState([null, null]);
  const [selectedSite, setSelectedSite] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingShift1Id, setEditingShift1Id] = useState(null);
  const [editingShift2Id, setEditingShift2Id] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    pageSizeOptions: ['10', '20', '50'],
  });

  // React Query hooks - use pagination state directly
  const queryParams = {
    page: pagination.current,
    limit: pagination.pageSize
  };

  // Add date range to query params if both dates are selected
  if (dateRange[0] && dateRange[1]) {
    queryParams.startDate = dateRange[0].format('YYYY-MM-DD');
    queryParams.endDate = dateRange[1].format('YYYY-MM-DD');
  }

  // Add site filter to query params if selected
  if (selectedSite) {
    queryParams.siteId = selectedSite;
  }

  const { data: entriesData = { data: [], total: 0, page: 1, limit: 10 }, isLoading: loading, refetch: refetchEntries } = useDailyEntries(queryParams);
  const { data: sites = [] } = useSites();
  const { data: machines = [] } = useMachines();
  const { data: compressors = [] } = useCompressors();
  const { data: employees = [] } = useEmployees();
  const { data: spares = [] } = useItemsByType('spare');

  // Mutations
  const createDailyEntry = useCreateDailyEntry();
  const updateDailyEntry = useUpdateDailyEntry();
  const deleteDailyEntry = useDeleteDailyEntry();

  const entries = entriesData.data || [];

  // Helper functions to get initial form state
  const getInitialShift1Data = () => ({
    siteId: null,
    machineId: null,
    compressorId: null,
    machineOpeningRPM: null,
    machineClosingRPM: null,
    compressorOpeningRPM: null,
    compressorClosingRPM: null,
    machineHSD: null,
    compressorHSD: null,
    dieselUsed: null,
    noOfHoles: null,
    meter: null,
    employees: [
      { id: Date.now(), role: 'operator', employeeId: null },
      { id: Date.now() + 1, role: 'helper', employeeId: null }
    ],
    drillingTools: [],
    machineServiceDone: false,
    machineServiceName: '',
    machineSpares: [],
    compressorServiceDone: false,
    compressorServiceName: '',
    compressorServiceType: null,
    compressorSpares: []
  });

  const getInitialShift2Data = () => ({
    siteId: null,
    machineId: null,
    compressorId: null,
    machineOpeningRPM: null,
    machineClosingRPM: null,
    compressorOpeningRPM: null,
    compressorClosingRPM: null,
    machineHSD: null,
    compressorHSD: null,
    dieselUsed: null,
    noOfHoles: null,
    meter: null,
    employees: [
      { id: Date.now() + 2, role: 'operator', employeeId: null },
      { id: Date.now() + 3, role: 'helper', employeeId: null }
    ],
    drillingTools: [], // Shift 2 usually doesn't do fitting? But structure should support it.
    machineServiceDone: false,
    machineServiceName: '',
    machineSpares: [],
    compressorServiceDone: false,
    compressorServiceName: '',
    compressorServiceType: null,
    compressorSpares: []
  });

  // State
  const [shift1Data, setShift1Data] = useState(getInitialShift1Data());
  const [shift2Data, setShift2Data] = useState(getInitialShift2Data());

  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [shift1Enabled, setShift1Enabled] = useState(true);
  const [shift2Enabled, setShift2Enabled] = useState(false);
  const [selectedShift1Machine, setSelectedShift1Machine] = useState(null);
  const [selectedShift2Machine, setSelectedShift2Machine] = useState(null);
  const [selectedShift1Compressor, setSelectedShift1Compressor] = useState(null);
  const [selectedShift2Compressor, setSelectedShift2Compressor] = useState(null);
  const [validationWarnings, setValidationWarnings] = useState([]);

  // Filter machines based on selected site
  const filteredMachines = useMemo(() => {
    if (!shift1Data.siteId) {
      return []; // Show no machines if no site is selected
    }
    return machines.filter(machine => machine.siteId === shift1Data.siteId);
  }, [machines, shift1Data.siteId]);

  // Inline item selection state
  const [showDrillingToolsSelector, setShowDrillingToolsSelector] = useState(false);

  // Fetch existing fitted drilling tools when compressor is selected
  const { data: existingDrillingTools = [] } = useFittedDrillingTools(selectedShift1Compressor?.id || null);

  // Create a stable reference for tool IDs to prevent infinite loops
  const existingToolIdsKey = useMemo(() => {
    return existingDrillingTools.map(t => t.itemServiceId || t.id).sort().join(',');
  }, [existingDrillingTools]);

  // Ref to track processed compressor and tools to prevent infinite loops
  const processedCompressorRef = useRef(null);
  const processedToolIdsRef = useRef(new Set());

  // Update pagination total and pageSize when entries data changes
  // Don't update 'current' from response - it's controlled by user interaction
  useEffect(() => {
    setPagination(prev => {
      const newTotal = entriesData.total || 0;
      const newPageSize = entriesData.limit || prev.pageSize;

      // Only update if values actually changed to prevent infinite loops
      if (newTotal === prev.total && newPageSize === prev.pageSize) {
        return prev;
      }

      return {
        ...prev,
        total: newTotal,
        pageSize: newPageSize,
      };
    });
  }, [entriesData.total, entriesData.limit]);

  // Fetch compressor fresh when machine changes (safety net for any direct machine changes)
  useEffect(() => {
    const fetchCompressorForMachine = async () => {
      if (selectedShift1Machine?.compressorId) {
        try {
          const res = await api.get(`/api/compressors/${selectedShift1Machine.compressorId}`);
          const compressor = res.data.data;

          if (compressor && compressor.id !== selectedShift1Compressor?.id) {
            // Only update if compressor actually changed to prevent loops
            setSelectedShift1Compressor(compressor);
            setSelectedShift2Compressor(compressor);

            // Update RPM if it's null/undefined (don't overwrite user-entered values)
            setShift1Data(prev => {
              if (prev.compressorOpeningRPM === null || prev.compressorOpeningRPM === undefined) {
                return {
                  ...prev,
                  compressorOpeningRPM: compressor?.compressorRPM || null,
                };
              }
              return prev;
            });

            setShift2Data(prev => {
              if (prev.compressorOpeningRPM === null || prev.compressorOpeningRPM === undefined) {
                return {
                  ...prev,
                  compressorOpeningRPM: compressor?.compressorRPM || null,
                };
              }
              return prev;
            });
          }
        } catch (error) {
          console.error("Error fetching compressor in useEffect:", error);
          // Silently fail - handleMachineChange will handle it
        }
      } else if (selectedShift1Machine && !selectedShift1Machine.compressorId) {
        // Machine has no compressor - clear compressor state
        if (selectedShift1Compressor) {
          setSelectedShift1Compressor(null);
          setSelectedShift2Compressor(null);
        }
      }
    };

    // Only fetch if machine is set and we're not in the middle of handleMachineChange
    if (selectedShift1Machine) {
      fetchCompressorForMachine();
    }
  }, [selectedShift1Machine?.id, selectedShift1Machine?.compressorId]); // Only depend on machine ID and compressorId

  // Auto-populate existing drilling tools when compressor is selected
  useEffect(() => {
    const compressorId = selectedShift1Compressor?.id;

    // Reset tracking if compressor changed
    if (compressorId !== processedCompressorRef.current) {
      processedCompressorRef.current = compressorId;
      processedToolIdsRef.current = new Set();
    }

    if (existingDrillingTools.length > 0 && selectedShift1Compressor) {
      // Create a stable key from processed tool IDs to detect changes
      const processedToolIdsKey = Array.from(processedToolIdsRef.current).sort().join(',');

      // Only process if tools have actually changed
      if (existingToolIdsKey !== processedToolIdsKey && existingToolIdsKey) {
        setShift1Data(prev => {
          // Check which existing tools are not yet in the state
          const existingToolIds = new Set(prev.drillingTools.filter(t => t.isExisting).map(t => t.itemServiceId));
          const newTools = existingDrillingTools
            .filter(tool => {
              const toolId = tool.itemServiceId || tool.id;
              return !existingToolIds.has(toolId) && !processedToolIdsRef.current.has(toolId);
            })
            .map(tool => {
              const toolId = tool.itemServiceId || tool.id;
              processedToolIdsRef.current.add(toolId);
              return {
                id: toolId,
                itemServiceId: toolId,
                itemId: tool.itemId,
                itemName: tool.itemName,
                partNumber: tool.partNumber,
                quantity: tool.quantity || 1,
                currentRPM: tool.currentRPM || 0,
                currentMeter: tool.currentMeter || 0,
                startingRPM: tool.currentRPM || 0,
                addedDate: tool.fittedDate || selectedDate.format("YYYY-MM-DD"),
                isExisting: true,
                action: 'update', // Default action for existing tools
              };
            });

          if (newTools.length > 0) {
            return {
              ...prev,
              drillingTools: [...prev.drillingTools, ...newTools]
            };
          }
          return prev;
        });
      }
    } else if (!selectedShift1Compressor) {
      // Clear existing drilling tools if compressor is deselected
      processedCompressorRef.current = null;
      processedToolIdsRef.current = new Set();
      setShift1Data(prev => ({
        ...prev,
        drillingTools: prev.drillingTools.filter(t => !t.isExisting)
      }));
    }
  }, [existingToolIdsKey, selectedShift1Compressor?.id, selectedDate]);

  // Auto-generate reference number helper
  const generateRefNoHelper = async () => {
    try {
      const res = await api.get("/api/dailyEntries/generate-ref");
      return res.data.refNo;
    } catch (err) {
      message.error("Error generating ref number");
      return `VA-${Date.now()}`;
    }
  };

  // Handle machine selection for shifts - auto-fill opening RPM from machine/compressor
  const handleMachineChange = async (machineId, shift) => {
    const machine = machines.find(m => m.id === machineId);

    if (shift === 1) {
      // Clear tools
      setShift1Data(prev => ({
        ...prev,
        drillingTools: [],
        machineId: machineId, // Update machineId here
        machineServiceDone: false,
        machineServiceName: '',
        machineSpares: [],
        compressorServiceDone: false,
        compressorServiceName: '',
        compressorServiceType: 'Compressor Service',
        compressorSpares: []
      })); // Reset machine related

      // Fetch fitted tools for this machine
      try {
        const res = await api.get(`/api/drilling-tools/fitted/${machineId}`); // Assuming machineId is the identifier for fitted tools
        if (res.data.success) {
          setShift1Data(prev => ({
            ...prev,
            drillingTools: res.data.data.map(tool => ({
              itemId: tool.id, // instance ID
              itemName: tool.catalogItem?.name || `Tool ${tool.id}`,
              serialNumber: tool.serialNumber,
              action: 'update', // Implicit update
              startingRPM: tool.currentRPM || 0,
              startingMeter: tool.currentMeter || 0
              // We don't set endingRPM/Meter yet, it's calculated dynamically
            }))
          }));
        }
      } catch (e) {
        // console.error("Could not fetch fitted tools", e);
        // Fail silently or just init empty
      }

      // Clear compressor state first to prevent stale data
      setSelectedShift1Compressor(null);
      setSelectedShift2Compressor(null);

      setSelectedShift1Machine(machine);
      setShift1Data(prev => ({
        ...prev,
        machineId: machineId,
        machineOpeningRPM: machine?.machineRPM || null, // Auto-fill from machine current RPM
        compressorId: machine?.compressorId || null,
        compressorOpeningRPM: null, // Clear first, will be set after fetch
      }));

      // Sync machine to Shift 2
      setSelectedShift2Machine(machine);

      // Fetch compressor fresh from API if machine has compressorId
      if (machine?.compressorId) {
        try {
          const res = await api.get(`/api/compressors/${machine.compressorId}`);
          const compressor = res.data.data;

          if (compressor) {
            // Update Shift 1 compressor
            setSelectedShift1Compressor(compressor);
            setShift1Data(prev => ({
              ...prev,
              compressorOpeningRPM: compressor?.compressorRPM || null, // Auto-fill from fresh compressor RPM
            }));

            // Update Shift 2 compressor
            setSelectedShift2Compressor(compressor);

            // Sync Shift 2 data - use Shift 1's closing RPM if set, otherwise use machine's current RPM
            const shouldAutoFill = shift1Data.machineClosingRPM === null;
            setShift2Data(prev => ({
              ...prev,
              machineId: machineId,
              compressorId: machine.compressorId,
              siteId: shift1Data.siteId || prev.siteId, // Sync site from Shift 1
              machineOpeningRPM: shouldAutoFill ? (machine?.machineRPM || null) : prev.machineOpeningRPM,
              compressorOpeningRPM: shouldAutoFill ? (compressor?.compressorRPM || null) : prev.compressorOpeningRPM,
            }));
          }
        } catch (error) {
          console.error("Error fetching compressor:", error);
          message.warning("Could not fetch compressor details. Using cached data.");
          // Fallback to cached data if API call fails
          const compressor = compressors.find(c => c.id === machine.compressorId);
          if (compressor) {
            setSelectedShift1Compressor(compressor);
            setSelectedShift2Compressor(compressor);
            setShift1Data(prev => ({
              ...prev,
              compressorOpeningRPM: compressor?.compressorRPM || null,
            }));
            const shouldAutoFill = shift1Data.machineClosingRPM === null;
            setShift2Data(prev => ({
              ...prev,
              machineId: machineId,
              compressorId: machine.compressorId,
              siteId: shift1Data.siteId || prev.siteId,
              machineOpeningRPM: shouldAutoFill ? (machine?.machineRPM || null) : prev.machineOpeningRPM,
              compressorOpeningRPM: shouldAutoFill ? (compressor?.compressorRPM || null) : prev.compressorOpeningRPM,
            }));
          }
        }
      } else {
        // No compressor - clear all compressor fields
        setSelectedShift1Compressor(null);
        setSelectedShift2Compressor(null);
        setShift1Data(prev => ({
          ...prev,
          compressorOpeningRPM: null,
        }));

        // Sync Shift 2 data without compressor
        const shouldAutoFill = shift1Data.machineClosingRPM === null;
        setShift2Data(prev => ({
          ...prev,
          machineId: machineId,
          compressorId: null,
          siteId: shift1Data.siteId || prev.siteId,
          machineOpeningRPM: shouldAutoFill ? (machine?.machineRPM || null) : prev.machineOpeningRPM,
          compressorOpeningRPM: null,
        }));
      }
    } else {
      // Shift 2 machine selection - UI allows changes but save will use Shift 1's machine
      setSelectedShift2Machine(machine);
      // Only auto-fill if Shift 1 closing RPM hasn't been set yet
      const shouldAutoFill = shift1Data.machineClosingRPM === null;

      // Clear compressor first
      setSelectedShift2Compressor(null);

      setShift2Data(prev => ({
        ...prev,
        machineId: machineId, // UI can change, but save will override with Shift 1's machineId
        machineOpeningRPM: shouldAutoFill ? (machine?.machineRPM || null) : prev.machineOpeningRPM,
        compressorId: machine?.compressorId || null,
        compressorOpeningRPM: null, // Clear first, will be set after fetch
      }));

      if (machine?.compressorId) {
        try {
          // Fetch compressor fresh from API
          const res = await api.get(`/api/compressors/${machine.compressorId}`);
          const compressor = res.data.data;

          if (compressor) {
            setSelectedShift2Compressor(compressor);
            setShift2Data(prev => ({
              ...prev,
              compressorOpeningRPM: shouldAutoFill ? (compressor?.compressorRPM || null) : prev.compressorOpeningRPM,
            }));
          }
        } catch (error) {
          console.error("Error fetching compressor:", error);
          // Fallback to cached data
          const compressor = compressors.find(c => c.id === machine.compressorId);
          if (compressor) {
            setSelectedShift2Compressor(compressor);
            setShift2Data(prev => ({
              ...prev,
              compressorOpeningRPM: shouldAutoFill ? (compressor?.compressorRPM || null) : prev.compressorOpeningRPM,
            }));
          }
        }
      } else {
        setSelectedShift2Compressor(null);
        setShift2Data(prev => ({
          ...prev,
          compressorOpeningRPM: null,
        }));
      }
    }
  };

  // Auto-fill Shift 2 opening RPM when Shift 2 is enabled or Shift 1 closing RPM changes
  useEffect(() => {
    if (shift2Enabled && shift1Data.machineClosingRPM !== null && shift1Data.machineClosingRPM !== undefined) {
      setShift2Data(prev => {
        // Only auto-fill if Shift 2 opening RPM is not already set
        if (prev.machineOpeningRPM === null || prev.machineOpeningRPM === undefined || prev.machineOpeningRPM === 0) {
          return { ...prev, machineOpeningRPM: shift1Data.machineClosingRPM };
        }
        return prev;
      });
    }
  }, [shift2Enabled, shift1Data.machineClosingRPM]);

  // Auto-fill Shift 2 opening compressor RPM when Shift 2 is enabled or Shift 1 closing RPM changes
  useEffect(() => {
    if (shift2Enabled && shift1Data.compressorClosingRPM !== null && shift1Data.compressorClosingRPM !== undefined) {
      setShift2Data(prev => {
        // Only auto-fill if Shift 2 opening RPM is not already set
        if (prev.compressorOpeningRPM === null || prev.compressorOpeningRPM === undefined || prev.compressorOpeningRPM === 0) {
          return { ...prev, compressorOpeningRPM: shift1Data.compressorClosingRPM };
        }
        return prev;
      });
    }
  }, [shift2Enabled, shift1Data.compressorClosingRPM]);

  // Add employee to shift
  const addEmployeeToShift = (shift) => {
    const newEmployee = { id: Date.now(), role: 'operator', employeeId: null };
    if (shift === 1) {
      setShift1Data(prev => ({
        ...prev,
        employees: [...prev.employees, newEmployee],
      }));
    } else {
      setShift2Data(prev => ({
        ...prev,
        employees: [...prev.employees, newEmployee],
      }));
    }
  };

  // Remove employee from shift
  const removeEmployeeFromShift = (shift, empId) => {
    if (shift === 1) {
      setShift1Data(prev => ({
        ...prev,
        employees: prev.employees.filter(e => e.id !== empId),
      }));
    } else {
      setShift2Data(prev => ({
        ...prev,
        employees: prev.employees.filter(e => e.id !== empId),
      }));
    }
  };

  // Update employee in shift
  const updateEmployeeInShift = (shift, empId, field, value) => {
    if (shift === 1) {
      setShift1Data(prev => ({
        ...prev,
        employees: prev.employees.map(e =>
          e.id === empId ? { ...e, [field]: value } : e
        ),
      }));
    } else {
      setShift2Data(prev => ({
        ...prev,
        employees: prev.employees.map(e =>
          e.id === empId ? { ...e, [field]: value } : e
        ),
      }));
    }
  };



  // Handle Add Drilling Tools button click - no service name needed
  const handleAddDrillingToolsClick = () => {
    if (!selectedShift1Compressor?.compressorName) {
      message.warning("Please select a compressor first");
      return;
    }
    setShowDrillingToolsSelector(true);
  };



  // Add drilling tool
  const handleAddDrillingTool = (item, quantity) => {
    // Check if this tool already exists (from existing fitted tools)
    const existingTool = shift1Data.drillingTools.find(t => t.itemId === item.id && t.isExisting);
    if (existingTool) {
      message.warning(`${item.itemName} is already fitted to this compressor`);
      return;
    }

    const currentBalance = item.balance ?? 0;
    if (quantity <= 0 || quantity > currentBalance) {
      message.error(`Invalid quantity. Available: ${currentBalance}, Required: ${quantity}`);
      return;
    }
    // Calculate total compressor RPM from both shifts (current day's RPM)
    const shift1RPM = (shift1Data.compressorClosingRPM || 0) - (shift1Data.compressorOpeningRPM || 0);
    const shift2RPM = (shift2Data.compressorClosingRPM || 0) - (shift2Data.compressorOpeningRPM || 0);
    const totalCompressorRPM = shift1RPM + shift2RPM;

    const newTool = {
      id: Date.now() + Math.random(),
      itemId: item.id,
      itemName: item.itemName,
      partNumber: item.partNumber,
      quantity: quantity,
      startingRPM: totalCompressorRPM,
      currentRPM: totalCompressorRPM,
      currentMeter: 0, // Will accumulate
      addedDate: selectedDate.format("YYYY-MM-DD"),
      balance: item.balance,
      isExisting: false,
      action: 'fit' // Mark as new tool to fit
    };
    setShift1Data(prev => ({
      ...prev,
      drillingTools: [...prev.drillingTools, newTool]
    }));
    message.success(`${item.itemName} added to drilling tools`);
  };



  // Remove drilling tool (restore stock)
  const handleRemoveDrillingTool = (toolId) => {
    const tool = shift1Data.drillingTools.find(t => t.id === toolId);
    if (tool) {
      // Mark as removed - backend will restore stock
      // Keep in array for payload, but mark as removed
      setShift1Data(prev => ({
        ...prev,
        drillingTools: prev.drillingTools.map(t =>
          t.id === toolId ? { ...t, action: 'remove' } : t
        )
      }));
      message.info(`${tool.itemName} marked for removal. Stock will be restored on save.`);
    }
  };

  // Update drilling tool RPM (manual edit)
  const handleUpdateDrillingToolRPM = (toolId, newRPM) => {
    setShift1Data(prev => ({
      ...prev,
      drillingTools: prev.drillingTools.map(t =>
        t.id === toolId ? { ...t, currentRPM: newRPM } : t
      )
    }));
  };

  // Update drilling tool Meter (manual edit)
  const handleUpdateDrillingToolMeter = (toolId, newMeter) => {
    setShift1Data(prev => ({
      ...prev,
      drillingTools: prev.drillingTools.map(t =>
        t.id === toolId ? { ...t, currentMeter: newMeter } : t
      )
    }));
  };

  // Handle form submit
  const handleSubmit = async () => {
    // Prevent duplicate submissions
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setValidationWarnings([]); // Clear previous warnings

    try {
      const dateStr = selectedDate.format("YYYY-MM-DD");

      // Shift 2 always uses Shift 1's siteId and vehicleId
      // Only RPM, meter, holes, and employees differ between shifts
      const shift2SiteId = shift1Data.siteId;
      const shift2MachineId = shift1Data.machineId;
      const shift2CompressorId = shift1Data.compressorId; // Compressor also same as Shift 1

      const warnings = [];

      // Collect validation warnings (non-blocking)
      if (shift1Enabled) {
        if (!shift1Data.siteId) {
          warnings.push("Shift 1: Site not selected");
        }
        if (!shift1Data.machineId) {
          warnings.push("Shift 1: Machine not selected");
        }
      }

      // Validate that Shift 1 has site and machine (since Shift 2 shares them)
      if (!shift1Data.siteId) {
        warnings.push("Shift 2: Site not selected (uses Shift 1's site)");
      }
      if (!shift1Data.machineId) {
        warnings.push("Shift 2: Machine not selected (uses Shift 1's machine)");
      }

      // Display warnings if any and prevent submission
      if (warnings.length > 0) {
        setValidationWarnings(warnings);
        setSubmitting(false);
        message.error("Please fix the validation errors before submitting");
        return;
      }

      // Check if we're in edit mode
      const isEditMode = editingShift1Id || editingShift2Id;

      // Get existing refNos if editing, otherwise generate new ones
      let refNo1 = null;
      let refNo2 = null;

      if (isEditMode) {
        // Fetch existing entries to get their refNos
        if (editingShift1Id) {
          try {
            const res = await api.get(`/api/dailyEntries/${editingShift1Id}`);
            refNo1 = res.data.data?.refNo;
          } catch (err) {
            console.error("Error fetching Shift 1 entry:", err);
          }
        }
        if (editingShift2Id) {
          try {
            const res = await api.get(`/api/dailyEntries/${editingShift2Id}`);
            refNo2 = res.data.data?.refNo;
          } catch (err) {
            console.error("Error fetching Shift 2 entry:", err);
          }
        }

        // Generate new refNos for shifts that don't exist yet
        if (!refNo1 && shift1Enabled) {
          refNo1 = await generateRefNoHelper();
        }
        if (!refNo2) {
          refNo2 = await generateRefNoHelper();
        }
      } else {
        // Create mode - generate new refNos
        if (shift1Enabled) {
          refNo1 = await generateRefNoHelper();
        }
        refNo2 = await generateRefNoHelper(); // Always generate for Shift 2
      }

      // Helper function to clean null values from payload (convert to undefined)
      const cleanPayload = (payload) => {
        const cleaned = { ...payload };
        // Convert null to undefined for optional fields so they're omitted from JSON
        if (cleaned.compressorId === null) delete cleaned.compressorId;
        return cleaned;
      };

      // Calculate daily compressor RPM and meter totals (both shifts combined)
      const shift1CompressorRPM = (shift1Data.compressorClosingRPM || 0) - (shift1Data.compressorOpeningRPM || 0);
      const shift2CompressorRPM = (shift2Data.compressorClosingRPM || 0) - (shift2Data.compressorOpeningRPM || 0);
      const dailyCompressorRPM = shift1CompressorRPM + shift2CompressorRPM;
      const dailyMeter = (shift1Data.meter || 0) + (shift2Data.meter || 0);

      // Helper function to prepare drilling tools payload
      const prepareDrillingToolsPayload = (tools) => {
        return tools.map(tool => ({
          itemId: tool.itemId,
          itemName: tool.itemName,
          partNumber: tool.partNumber,
          quantity: tool.quantity || 1,
          itemServiceId: tool.itemServiceId,
          action: tool.action || (tool.isExisting ? 'update' : 'fit'),
          dailyRPM: dailyCompressorRPM,
          dailyMeter: dailyMeter,
          startingRPM: tool.startingRPM || 0,
          currentRPM: tool.currentRPM || 0,
          addedDate: tool.addedDate || dateStr,
        }));
      };

      // Save Shift 1
      if (shift1Enabled) {
        try {
          console.log("DEBUG: Submitting Shift 1 Payload:", { siteId: shift1Data.siteId, machineId: shift1Data.machineId });
          const payload1 = cleanPayload({
            refNo: refNo1,
            date: dateStr,
            shift: 1,
            siteId: shift1Data.siteId,
            machineId: shift1Data.machineId,
            compressorId: shift1Data.compressorId,
            machineOpeningRPM: shift1Data.machineOpeningRPM ?? 0,
            machineClosingRPM: shift1Data.machineClosingRPM ?? 0,
            compressorOpeningRPM: shift1Data.compressorOpeningRPM ?? 0,
            compressorClosingRPM: shift1Data.compressorClosingRPM ?? 0,
            dieselUsed: shift1Data.dieselUsed ?? 0,
            machineHSD: shift1Data.machineHSD ?? 0,
            compressorHSD: shift1Data.compressorHSD ?? 0,
            vehicleServiceDone: false,
            vehicleServiceName: null,
            compressorServiceDone: false,
            compressorServiceName: null,
            compressorServiceType: null,
            noOfHoles: shift1Data.noOfHoles ?? 0,
            meter: shift1Data.meter ?? 0,
            employees: shift1Data.employees
              .filter(e => e.employeeId)
              .map(e => ({ employeeId: e.employeeId, role: e.role, shift: 1 })),
            notes: "",
            // New spares structure
            machineSpares: shift1Data.machineSpares,
            compressorSpares: shift1Data.compressorSpares,
            drillingTools: prepareDrillingToolsPayload(shift1Data.drillingTools || []),
            machineServiceDone: shift1Data.machineServiceDone,
            machineServiceName: shift1Data.machineServiceName,
            compressorServiceDone: shift1Data.compressorServiceDone,
            compressorServiceName: shift1Data.compressorServiceName,
            compressorServiceType: shift1Data.compressorServiceType,
          });

          // Use update if editing, create if new
          if (editingShift1Id) {
            await updateDailyEntry.mutateAsync({ id: editingShift1Id, ...payload1 });
          } else {
            await createDailyEntry.mutateAsync(payload1);
          }
        } catch (error) {
          message.error(`Failed to save Shift 1: ${error?.response?.data?.message || error?.message || 'Unknown error'}`);
          setSubmitting(false);
          return;
        }
      }

      // Save Shift 2 (only if enabled)
      if (shift2Enabled) {
        // Shift 2 uses same siteId, vehicleId, and compressorId as Shift 1
        // Only RPM, meter, holes, and employees differ between shifts
        // Note: Drilling tools are only sent in Shift 1 payload since daily RPM/meter is calculated from both shifts
        try {
          const payload2 = cleanPayload({
            refNo: refNo2,
            date: dateStr,
            shift: 2,
            siteId: shift2SiteId, // Always use Shift 1's siteId
            machineId: shift2MachineId, // Always use Shift 1's machineId
            compressorId: shift2CompressorId, // Always use Shift 1's compressorId
            machineOpeningRPM: shift2Data.machineOpeningRPM ?? 0,
            machineClosingRPM: shift2Data.machineClosingRPM ?? 0,
            compressorOpeningRPM: shift2Data.compressorOpeningRPM ?? 0,
            compressorClosingRPM: shift2Data.compressorClosingRPM ?? 0,
            dieselUsed: shift2Data.dieselUsed ?? 0,
            machineHSD: shift2Data.machineHSD ?? 0,
            machineHSD: shift2Data.machineHSD ?? 0,
            compressorHSD: shift2Data.compressorHSD ?? 0,
            vehicleServiceDone: false,
            vehicleServiceName: null,
            compressorServiceDone: false,
            compressorServiceName: null,
            compressorServiceType: null,
            noOfHoles: shift2Data.noOfHoles ?? 0,
            meter: shift2Data.meter ?? 0,
            employees: shift2Data.employees
              .filter(e => e.employeeId)
              .map(e => ({ employeeId: e.employeeId, role: e.role, shift: 2 })),
            notes: "",
            // New spares structure
            machineSpares: [],
            compressorSpares: [],
            // Drilling tools not sent in Shift 2 - handled in Shift 1 with combined RPM/meter
          });

          // Use update if editing, create if new
          if (editingShift2Id) {
            await updateDailyEntry.mutateAsync({ id: editingShift2Id, ...payload2 });
          } else {
            await createDailyEntry.mutateAsync(payload2);
          }
        } catch (error) {
          message.error(`Failed to save Shift 2: ${error?.response?.data?.message || error?.message || 'Unknown error'}`);
          setSubmitting(false);
          return;
        }
      }

      // Clear warnings on success (mutations handle success messages)
      setValidationWarnings([]);
      setSubmitting(false);
      refetchEntries();

      // Remove tools marked for removal from state after successful submission
      setShift1Data(prev => ({
        ...prev,
        drillingTools: prev.drillingTools.filter(t => t.action !== 'remove')
      }));

      // Clear edit mode state
      setEditingShift1Id(null);
      setEditingShift2Id(null);

      handleCancel();

    } catch (err) {
      // Error is already handled by mutation hook
      setSubmitting(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setEditingShift1Id(null);
    setEditingShift2Id(null);
    setValidationWarnings([]); // Clear warnings on cancel
    setShift1Enabled(true);
    setShift2Enabled(false);
    setShift1Data(getInitialShift1Data());
    setShift2Data(getInitialShift2Data());
    setSelectedShift1Machine(null);
    setSelectedShift2Machine(null);
    setSelectedShift1Compressor(null);
    setSelectedShift2Compressor(null);
  };

  // Handle edit - open EditDailyEntry modal (only for the clicked shift)
  const handleEdit = async (record) => {
    try {
      // Fetch the clicked entry details
      const res = await api.get(`/api/dailyEntries/${record.id}`);
      const clickedEntry = res.data.data;

      if (!clickedEntry) {
        message.error("Entry not found");
        return;
      }

      const clickedShift = clickedEntry.shift || 1;

      // Only set the ID for the clicked shift, not the other shift
      if (clickedShift === 1) {
        setEditingShift1Id(clickedEntry.id);
        setEditingShift2Id(null);
      } else {
        setEditingShift1Id(null);
        setEditingShift2Id(clickedEntry.id);
      }

      setShowEditModal(true);
    } catch (error) {
      console.error("Error loading entry for edit:", error);
      message.error("Failed to load entry for editing");
    }
  };

  // Handle delete
  const handleDelete = async (id) => {
    deleteDailyEntry.mutate(id);
  };

  // renderShiftSection removed

  const updateShiftData = (field, value) => {
    if (shift === 1) {
      setShift1Data(prev => ({ ...prev, [field]: value }));
    } else {
      setShift2Data(prev => ({ ...prev, [field]: value }));
    }
  };

  // Dropdown Selector Components



  const SparesDropdown = ({ onAdd, onClose, type = 'machine' }) => {
    // Filter spares if needed? For now show all spares
    const [selectedSpareId, setSelectedSpareId] = useState(null);
    const [quantity, setQuantity] = useState(1);

    const handleAdd = () => {
      const spare = spares.find(s => s.id === selectedSpareId);
      if (spare) {
        onAdd({
          itemId: spare.id,
          itemName: spare.name,
          partNumber: spare.partNumber,
          quantity: quantity
        });
        setSelectedSpareId(null);
        setQuantity(1);
      }
    };

    return (
      <Row gutter={[4, 4]} style={{ marginBottom: '4px' }}>
        <Col span={14}>
          <Select
            size="small"
            placeholder="Select Spare"
            value={selectedSpareId}
            onChange={setSelectedSpareId}
            showSearch
            optionFilterProp="children"
            style={{ width: '100%' }}
          >
            {spares.map(s => <Select.Option key={s.id} value={s.id}>{s.name} ({s.partNumber})</Select.Option>)}
          </Select>
        </Col>
        <Col span={4}>
          <InputNumber size="small" min={1} value={quantity} onChange={setQuantity} style={{ width: '100%' }} />
        </Col>
        <Col span={6}>
          <Space>
            <Button size="small" type="primary" onClick={handleAdd}>Add</Button>
            <Button size="small" onClick={onClose}>Cancel</Button>
          </Space>
        </Col>
      </Row>
    );
  };

  const DrillingToolsDropdown = ({ onAdd, onClose }) => {
    // We already have useItemsByType for Catalog Items.
    // We need Instances.
    // For now, let's assume we fetch Available Instances for the Site?
    // User requested "Fitting" -> Select from Available.
    // "Remove" -> Already in list.

    // I'll assume we list "Available" tools here.
    const [availableTools, setAvailableTools] = useState([]);

    useEffect(() => {
      // Fetch available tools
      api.get('/api/drilling-tools/instances?status=In Stock').then(res => {
        if (res.data.success) setAvailableTools(res.data.data);
      });
    }, []);

    const [selectedToolId, setSelectedToolId] = useState(null);

    const handleAdd = () => {
      const tool = availableTools.find(t => t.id === selectedToolId);
      if (tool) {
        onAdd({
          itemId: tool.id,
          itemName: tool.catalogItem?.name || `Tool ${tool.id}`,
          serialNumber: tool.serialNumber,
          currentRPM: tool.currentRPM,
          currentMeter: tool.currentMeter,
          action: 'fit'
        });
        setSelectedToolId(null);
      }
    };

    return (
      <Row gutter={[4, 4]} style={{ marginBottom: '4px' }}>
        <Col span={18}>
          <Select
            size="small"
            placeholder="Select drilling tool to FIT"
            value={selectedToolId}
            onChange={setSelectedToolId}
            showSearch
            style={{ width: '100%', fontSize: '11px' }}
          >
            {availableTools.map(item => (
              <Select.Option key={item.id} value={item.id}>
                {item.catalogItem?.name} ({item.serialNumber})
              </Select.Option>
            ))}
          </Select>
        </Col>
        <Col span={6}>
          <Space>
            <Button size="small" type="primary" onClick={handleAdd}>Fit</Button>
            <Button size="small" onClick={onClose}>Cancel</Button>
          </Space>
        </Col>
      </Row>
    );
  };

  // Table columns
  const columns = [
    { title: "Ref No", dataIndex: "refNo", key: "refNo" },
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      render: (date) => (date ? dayjs(date).format("YYYY-MM-DD") : "-"),
    },
    {
      title: "Shift",
      dataIndex: "shift",
      key: "shift",
      render: (shift) => <Tag color={shift === 1 ? 'blue' : 'green'}>Shift {shift || 1}</Tag>,
    },
    {
      title: "Machine",
      key: "machine",
      render: (_, record) => {
        const machine = record.machine || machines.find(m => m.id === record.machineId);
        if (!machine) return '-';
        return `${machine.machineType || 'Machine'} (${machine.machineNumber || ''})`;
      }
    },
    {
      title: "Site",
      key: "site",
      render: (_, record) => {
        const site = record.site || sites.find(s => s.id === record.siteId);
        return site?.siteName || '-';
      }
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space>
          {canEdit() && (
            <Button
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          )}
          {canDelete() && (
            <Popconfirm
              title="Are you sure you want to delete this entry?"
              onConfirm={() => handleDelete(record.id)}
              okText="Yes"
              cancelText="No"
            >
              <Button danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header - Hide button when form is open */}
      {!showForm && (
        <div className="flex justify-end items-center mb-4">
          {canCreate() && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                // Reset form state before showing the form
                setShift1Data(getInitialShift1Data());
                setShift2Data(getInitialShift2Data());
                setShift1Enabled(true);
                setShift2Enabled(false);
                setSelectedShift1Machine(null);
                setSelectedShift2Machine(null);
                setSelectedShift1Compressor(null);
                setSelectedShift2Compressor(null);
                setSelectedDate(dayjs());
                setValidationWarnings([]);
                setShowForm(true);
              }}
            >
              Add Daily Entry
            </Button>
          )}
        </div>
      )}

      {/* Daily Entry Form - Compact Single Page Layout */}
      {showForm && (
        <Card
          title="Add Daily Entry"
          className="mb-2"
          bodyStyle={{ padding: '4px' }}
        >
          <div style={{ padding: '0', margin: '0' }}>
            {/* Top Row: Ref No, Date, Site, Machine Type, Compressor No */}
            <Row gutter={[4, 4]} style={{ marginBottom: '4px' }}>
              <Col span={5}>
                <Text strong style={{ fontSize: '11px', display: 'block', marginBottom: '2px' }}>Ref No:</Text>
                <Input
                  size="small"
                  placeholder="Auto-generated"
                  disabled
                  style={{ fontSize: '11px' }}
                />
              </Col>
              <Col span={5}>
                <Text strong style={{ fontSize: '11px', display: 'block', marginBottom: '2px' }}>Date:</Text>
                <DatePicker
                  size="small"
                  className="w-full"
                  value={selectedDate}
                  onChange={setSelectedDate}
                  format="DD/MM/YYYY"
                  style={{ fontSize: '11px' }}
                />
              </Col>
              <Col span={5}>
                <Text strong style={{ fontSize: '11px', display: 'block', marginBottom: '2px' }}>Site Name:</Text>
                <Select
                  size="small"
                  className="w-full"
                  placeholder="Select site"
                  value={shift1Data.siteId}
                  onChange={(value) => {
                    setShift1Data(prev => {
                      const newSiteId = value;
                      // Check if currently selected machine belongs to new site
                      const currentMachine = machines.find(m => m.id === prev.machineId);
                      const shouldClearMachine = currentMachine && currentMachine.siteId !== newSiteId;

                      return {
                        ...prev,
                        siteId: newSiteId,
                        machineId: shouldClearMachine ? null : prev.machineId, // Clear machine if it doesn't belong to new site
                      };
                    });
                    setShift2Data(prev => ({ ...prev, siteId: value })); // Always sync to Shift 2

                    // Also clear selected machine references if machine was cleared
                    const currentMachine = machines.find(m => m.id === shift1Data.machineId);
                    if (currentMachine && currentMachine.siteId !== value) {
                      setSelectedShift1Machine(null);
                      setSelectedShift2Machine(null);
                    }
                  }}
                  showSearch
                  optionFilterProp="children"
                  style={{ fontSize: '11px' }}
                >
                  {sites.map(site => (
                    <Select.Option key={site.id} value={site.id}>
                      {site.siteName}
                    </Select.Option>
                  ))}
                </Select>
              </Col>
              <Col span={5}>
                <Text strong style={{ fontSize: '11px', display: 'block', marginBottom: '2px' }}>Machine Type:</Text>
                <Select
                  size="small"
                  className="w-full"
                  placeholder="Select machine"
                  value={shift1Data.machineId}
                  onChange={(value) => handleMachineChange(value, 1)}
                  showSearch
                  optionFilterProp="children"
                  style={{ fontSize: '11px' }}
                >
                  {filteredMachines.map(machine => (
                    <Select.Option key={machine.id} value={machine.id}>
                      {machine.machineNumber} - {machine.machineType}
                    </Select.Option>
                  ))}
                </Select>
              </Col>
              <Col span={4}>
                <Text strong style={{ fontSize: '11px', display: 'block', marginBottom: '2px' }}>Compressor No:</Text>
                <Input
                  size="small"
                  value={selectedShift1Compressor?.compressorName || ''}
                  disabled
                  style={{ fontSize: '11px' }}
                />
              </Col>
            </Row>

            {/* Shift 2 Toggle */}
            <Row gutter={[4, 4]} style={{ marginBottom: '4px', marginTop: '4px' }}>
              <Col span={24}>
                <Space>
                  <Text strong style={{ fontSize: '11px' }}>Enable Shift 2:</Text>
                  <Switch
                    checked={shift2Enabled}
                    onChange={(checked) => {
                      setShift2Enabled(checked);
                      // Auto-fill Shift 2 opening RPM when toggled on
                      if (checked && shift1Data.machineClosingRPM) {
                        setShift2Data(prev => ({
                          ...prev,
                          machineOpeningRPM: shift1Data.machineClosingRPM,
                          compressorOpeningRPM: shift1Data.compressorClosingRPM || prev.compressorOpeningRPM,
                        }));
                      }
                    }}
                    size="small"
                  />
                </Space>
              </Col>
            </Row>

            {/* Shift Data Table - Compact Table Format */}
            <Table
              size="small"
              pagination={false}
              dataSource={[
                {
                  key: 'shift1',
                  shift: 'Shift 1',
                  data: shift1Data,
                  enabled: shift1Enabled // Always enabled
                },
                ...(shift2Enabled ? [{
                  key: 'shift2',
                  shift: 'Shift 2',
                  data: shift2Data,
                  enabled: shift2Enabled // Controlled by toggle
                }] : [])
              ]}
              columns={[
                {
                  title: 'Shift',
                  dataIndex: 'shift',
                  key: 'shift',
                  width: 80,
                  render: (text) => (
                    <Text style={{ fontSize: '12px' }}>{text}</Text>
                  )
                },
                {
                  title: 'Machine RPM',
                  children: [
                    {
                      title: 'Opening',
                      dataIndex: ['data', 'machineOpeningRPM'],
                      key: 'machineOpening',
                      width: 100,
                      render: (_, record) => (
                        <InputNumber
                          size="small"
                          placeholder="0.0"
                          value={record.data.machineOpeningRPM}
                          onChange={(value) => {
                            if (record.key === 'shift1') {
                              setShift1Data(prev => ({ ...prev, machineOpeningRPM: value }));
                            } else {
                              setShift2Data(prev => ({ ...prev, machineOpeningRPM: value }));
                            }
                          }}
                          min={0}
                          step={0.1}
                          precision={1}
                          controls={false}
                          style={{ width: '100%', fontSize: '12px' }}
                        />
                      )
                    },
                    {
                      title: 'Closing',
                      dataIndex: ['data', 'machineClosingRPM'],
                      key: 'machineClosing',
                      width: 100,
                      render: (_, record) => (
                        <InputNumber
                          size="small"
                          placeholder="0.0"
                          value={record.data.machineClosingRPM}
                          onChange={(value) => {
                            if (record.key === 'shift1') {
                              setShift1Data(prev => ({ ...prev, machineClosingRPM: value }));
                              // Auto-fill Shift 2 opening when Shift 1 closing is typed (only if Shift 2 is enabled)
                              if (shift2Enabled) {
                                setShift2Data(prev => ({ ...prev, machineOpeningRPM: value }));
                              }
                            } else {
                              setShift2Data(prev => ({ ...prev, machineClosingRPM: value }));
                            }
                          }}
                          min={0}
                          step={0.1}
                          precision={1}
                          controls={false}
                          style={{ width: '100%', fontSize: '12px' }}
                        />
                      )
                    }
                  ]
                },
                {
                  title: 'Compressor RPM',
                  children: [
                    {
                      title: 'Opening',
                      key: 'compressorOpening',
                      width: 100,
                      render: (_, record) => (
                        <InputNumber
                          size="small"
                          placeholder="0.0"
                          value={record.data.compressorOpeningRPM}
                          onChange={(value) => {
                            if (record.key === 'shift1') {
                              setShift1Data(prev => ({ ...prev, compressorOpeningRPM: value }));
                            } else {
                              setShift2Data(prev => ({ ...prev, compressorOpeningRPM: value }));
                            }
                          }}
                          min={0}
                          step={0.1}
                          precision={1}
                          controls={false}
                          style={{ width: '100%', fontSize: '12px' }}
                        />
                      )
                    },
                    {
                      title: 'Closing',
                      key: 'compressorClosing',
                      width: 100,
                      render: (_, record) => (
                        <InputNumber
                          size="small"
                          placeholder="0.0"
                          value={record.data.compressorClosingRPM}
                          onChange={(value) => {
                            if (record.key === 'shift1') {
                              setShift1Data(prev => ({ ...prev, compressorClosingRPM: value }));
                              // Auto-fill Shift 2 opening when Shift 1 closing is typed (only if Shift 2 is enabled)
                              if (shift2Enabled) {
                                setShift2Data(prev => ({ ...prev, compressorOpeningRPM: value }));
                              }
                            } else {
                              setShift2Data(prev => ({ ...prev, compressorClosingRPM: value }));
                            }
                          }}
                          min={0}
                          step={0.1}
                          precision={1}
                          controls={false}
                          style={{ width: '100%', fontSize: '12px' }}
                        />
                      )
                    }
                  ]
                },
                {
                  title: 'Total Machine RPM',
                  key: 'totalMachineRPM',
                  width: 120,
                  render: (_, record) => {
                    const total = (record.data.machineClosingRPM || 0) - (record.data.machineOpeningRPM || 0);
                    return (
                      <Text style={{ fontSize: '12px' }}>{truncateToFixed(total, 2)}</Text>
                    );
                  }
                },
                {
                  title: 'Total Compressor RPM',
                  key: 'totalCompressorRPM',
                  width: 120,
                  render: (_, record) => {
                    const total = (record.data.compressorClosingRPM || 0) - (record.data.compressorOpeningRPM || 0);
                    return (
                      <Text style={{ fontSize: '12px' }}>{truncateToFixed(total, 2)}</Text>
                    );
                  }
                },
                {
                  title: 'No of Holes',
                  key: 'holes',
                  width: 100,
                  render: (_, record) => (
                    <InputNumber
                      size="small"
                      placeholder="0"
                      value={record.data.noOfHoles}
                      onChange={(value) => {
                        if (record.key === 'shift1') {
                          setShift1Data(prev => ({ ...prev, noOfHoles: value }));
                        } else {
                          setShift2Data(prev => ({ ...prev, noOfHoles: value }));
                        }
                      }}
                      min={0}
                      controls={false}
                      style={{ width: '100%', fontSize: '12px' }}
                    />
                  )
                },
                {
                  title: 'Machine HSD',
                  key: 'machineHSD',
                  width: 100,
                  render: (_, record) => (
                    <InputNumber
                      size="small"
                      placeholder="0.0"
                      value={record.data.machineHSD}
                      onChange={(value) => {
                        if (record.key === 'shift1') {
                          setShift1Data(prev => ({ ...prev, machineHSD: value }));
                        } else {
                          setShift2Data(prev => ({ ...prev, machineHSD: value }));
                        }
                      }}
                      min={0}
                      step={0.1}
                      precision={1}
                      controls={false}
                      style={{ width: '100%', fontSize: '12px' }}
                    />
                  )
                },
                {
                  title: 'Compressor HSD',
                  key: 'compressorHSD',
                  width: 100,
                  render: (_, record) => (
                    <InputNumber
                      size="small"
                      placeholder="0.0"
                      value={record.data.compressorHSD}
                      onChange={(value) => {
                        if (record.key === 'shift1') {
                          setShift1Data(prev => ({ ...prev, compressorHSD: value }));
                        } else {
                          setShift2Data(prev => ({ ...prev, compressorHSD: value }));
                        }
                      }}
                      min={0}
                      step={0.1}
                      precision={1}
                      controls={false}
                      style={{ width: '100%', fontSize: '12px' }}
                    />
                  )
                },
                {
                  title: 'Total Production Meter',
                  key: 'meter',
                  width: 120,
                  render: (_, record) => (
                    <InputNumber
                      size="small"
                      placeholder="0.0"
                      value={record.data.meter}
                      onChange={(value) => {
                        if (record.key === 'shift1') {
                          setShift1Data(prev => ({ ...prev, meter: value }));
                        } else {
                          setShift2Data(prev => ({ ...prev, meter: value }));
                        }
                      }}
                      min={0}
                      step={0.1}
                      precision={1}
                      controls={false}
                      style={{ width: '100%', fontSize: '12px' }}
                    />
                  )
                }
              ]}
              style={{ marginBottom: '4px', fontSize: '11px' }}
            />

            {/* Employee Section - Compact Grid Layout */}
            <Row gutter={[4, 4]} style={{ marginBottom: '4px' }}>
              <Col span={shift2Enabled ? 12 : 24}>
                <Text strong style={{ fontSize: '11px' }}>Shift 1 Employees:</Text>
                {shift1Data.employees.map((emp, idx) => (
                  <Row key={emp.id} gutter={[4, 4]} style={{ marginTop: '2px', marginBottom: '2px' }}>
                    <Col span={8}>
                      <Select
                        size="small"
                        placeholder="Role"
                        value={emp.role}
                        onChange={(value) => updateEmployeeInShift(1, emp.id, 'role', value)}
                        style={{ width: '100%', fontSize: '11px' }}
                        dropdownMatchSelectWidth={false}
                      >
                        <Select.Option value="operator">Operator</Select.Option>
                        <Select.Option value="helper">Helper</Select.Option>
                      </Select>
                    </Col>
                    <Col span={14}>
                      <Select
                        size="small"
                        placeholder="Employee"
                        value={emp.employeeId}
                        onChange={(value) => updateEmployeeInShift(1, emp.id, 'employeeId', value)}
                        showSearch
                        optionFilterProp="children"
                        style={{ width: '100%', fontSize: '11px' }}
                        dropdownMatchSelectWidth={false}
                      >
                        {employees.map(employee => (
                          <Select.Option key={employee.id} value={employee.id}>
                            {employee.name} ({employee.empId}){employee.designation ? ` - ${employee.designation}` : ''}
                          </Select.Option>
                        ))}
                      </Select>
                    </Col>
                    <Col span={2}>
                      <Button
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => removeEmployeeFromShift(1, emp.id)}
                        style={{ padding: '0', height: '24px', width: '24px' }}
                      />
                    </Col>
                  </Row>
                ))}
                <Button
                  size="small"
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => addEmployeeToShift(1)}
                  style={{ fontSize: '11px', marginTop: '2px', height: '24px', padding: '0 8px' }}
                >
                  Add
                </Button>
              </Col>
              {shift2Enabled && (
                <Col span={12}>
                  <Text strong style={{ fontSize: '11px' }}>Shift 2 Employees:</Text>
                  {shift2Data.employees.map((emp) => (
                    <Row key={emp.id} gutter={[4, 4]} style={{ marginTop: '2px', marginBottom: '2px' }}>
                      <Col span={8}>
                        <Select
                          size="small"
                          placeholder="Role"
                          value={emp.role}
                          onChange={(value) => updateEmployeeInShift(2, emp.id, 'role', value)}
                          style={{ width: '100%', fontSize: '11px' }}
                          dropdownMatchSelectWidth={false}
                        >
                          <Select.Option value="operator">Operator</Select.Option>
                          <Select.Option value="helper">Helper</Select.Option>
                        </Select>
                      </Col>
                      <Col span={14}>
                        <Select
                          size="small"
                          placeholder="Employee"
                          value={emp.employeeId}
                          onChange={(value) => updateEmployeeInShift(2, emp.id, 'employeeId', value)}
                          showSearch
                          optionFilterProp="children"
                          style={{ width: '100%', fontSize: '11px' }}
                          dropdownMatchSelectWidth={false}
                        >
                          {employees.map(employee => (
                            <Select.Option key={employee.id} value={employee.id}>
                              {employee.name} ({employee.empId}){employee.designation ? ` - ${employee.designation}` : ''}
                            </Select.Option>
                          ))}
                        </Select>
                      </Col>
                      <Col span={2}>
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => removeEmployeeFromShift(2, emp.id)}
                          style={{ padding: '0', height: '24px', width: '24px' }}
                        />
                      </Col>
                    </Row>
                  ))}
                  <Button
                    size="small"
                    type="dashed"
                    icon={<PlusOutlined />}
                    onClick={() => addEmployeeToShift(2)}
                    style={{ fontSize: '11px', marginTop: '2px', height: '24px', padding: '0 8px' }}
                  >
                    Add
                  </Button>
                </Col>
              )}
            </Row>

            {/* Service & Maintenance Implementation */}
            <Divider orientation="left" style={{ margin: '8px 0', fontSize: '12px' }}>Service & Maintenance</Divider>
            <div className="bg-gray-50 p-2 rounded mb-4" style={{ border: '1px solid #f0f0f0' }}>
              {/* Machine Service */}
              <Row gutter={16} align="middle" style={{ marginBottom: '8px' }}>
                <Col span={6}>
                  <Space>
                    <Switch
                      size="small"
                      checked={shift1Data.machineServiceDone}
                      onChange={(c) => setShift1Data(prev => ({ ...prev, machineServiceDone: c }))}
                    />
                    <Text strong style={{ fontSize: '11px' }}>Machine Service</Text>
                  </Space>
                </Col>
                {shift1Data.machineServiceDone && (
                  <>
                    <Col span={8}>
                      <Input
                        size="small"
                        placeholder="Service Name (e.g. 500H)"
                        value={shift1Data.machineServiceName}
                        onChange={e => setShift1Data(prev => ({ ...prev, machineServiceName: e.target.value }))}
                        style={{ fontSize: '11px' }}
                      />
                    </Col>
                    <Col span={10}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {shift1Data.machineSpares.map((spare, idx) => (
                          <Tag key={idx} closable onClose={() => {
                            const newSpares = [...shift1Data.machineSpares];
                            newSpares.splice(idx, 1);
                            setShift1Data(prev => ({ ...prev, machineSpares: newSpares }));
                          }} style={{ fontSize: '10px' }}>
                            {spare.itemName} ({spare.quantity})
                          </Tag>
                        ))}

                        <SparesDropdown
                          type="machine"
                          onAdd={(item) => {
                            setShift1Data(prev => ({ ...prev, machineSpares: [...prev.machineSpares, item] }));
                          }}
                          onClose={() => { }}
                        />
                      </div>
                    </Col>
                  </>
                )}
              </Row>

              {/* Compressor Service */}
              {shift1Data.compressorId && (
                <Row gutter={16} align="middle">
                  <Col span={6}>
                    <Space>
                      <Switch
                        size="small"
                        checked={shift1Data.compressorServiceDone}
                        onChange={(c) => setShift1Data(prev => ({ ...prev, compressorServiceDone: c }))}
                      />
                      <Text strong style={{ fontSize: '11px' }}>Compressor Service</Text>
                    </Space>
                  </Col>
                  {shift1Data.compressorServiceDone && (
                    <>
                      <Col span={8}>
                        <Input
                          size="small"
                          placeholder="Service Name"
                          value={shift1Data.compressorServiceName}
                          onChange={e => setShift1Data(prev => ({ ...prev, compressorServiceName: e.target.value }))}
                          style={{ fontSize: '11px', marginBottom: '2px' }}
                        />
                        <Select
                          size="small"
                          value={shift1Data.compressorServiceType}
                          onChange={v => setShift1Data(prev => ({ ...prev, compressorServiceType: v }))}
                          style={{ width: '100%', fontSize: '11px' }}
                        >
                          <Select.Option value="Compressor Service">Compressor Cycle</Select.Option>
                          <Select.Option value="Engine Service">Engine Cycle</Select.Option>
                        </Select>
                      </Col>
                      <Col span={10}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {shift1Data.compressorSpares.map((spare, idx) => (
                            <Tag key={idx} closable onClose={() => {
                              const newSpares = [...shift1Data.compressorSpares];
                              newSpares.splice(idx, 1);
                              setShift1Data(prev => ({ ...prev, compressorSpares: newSpares }));
                            }} style={{ fontSize: '10px' }}>
                              {spare.itemName} ({spare.quantity})
                            </Tag>
                          ))}
                          <SparesDropdown
                            type="compressor"
                            onAdd={(item) => {
                              setShift1Data(prev => ({ ...prev, compressorSpares: [...prev.compressorSpares, item] }));
                            }}
                            onClose={() => { }}
                          />
                        </div>
                      </Col>
                    </>
                  )}
                </Row>
              )}
            </div>
            <div style={{ marginBottom: '4px' }}>
              <Row align="middle" justify="space-between" style={{ marginBottom: '6px' }}>
                {/* Empty Row kept for spacing or remove entirely? I'll just remove the service name content */}
              </Row>

              <Col span={24}>
                <Button
                  size="small"
                  type="primary"
                  icon={<ToolOutlined />}
                  onClick={handleAddDrillingToolsClick}
                  disabled={!selectedShift1Compressor}
                  block
                  style={{ fontSize: '11px', height: '28px' }}
                >
                  Add Drilling Tools
                </Button>
              </Col>

              {/* Dropdown Selectors */}

              {showDrillingToolsSelector && selectedShift1Compressor && (
                <DrillingToolsDropdown
                  onAdd={(item, qty) => {
                    handleAddDrillingTool(item, qty);
                    setShowDrillingToolsSelector(false);
                  }}
                  onClose={() => setShowDrillingToolsSelector(false)}
                />
              )}

              {/* Single Table with 3 Columns */}
              <Table
                size="small"
                pagination={false}
                dataSource={shift1Data.drillingTools}
                columns={[
                  {
                    title: 'Drilling Tool',
                    key: 'drillingTools',
                    width: '35%',
                    render: (_, record) => (
                      <Text style={{ fontSize: '11px' }}>{record.itemName} ({record.serialNumber})</Text>
                    )
                  },
                  {
                    title: 'Status',
                    key: 'status',
                    width: '15%',
                    render: (_, r) => r.action === 'fit' ? <Tag color="green">Fitting</Tag> : <Tag color="blue">Fitted</Tag>
                  },
                  {
                    title: 'Usage',
                    key: 'usage', // Fixed: unique key
                    width: '30%',
                    render: (_, record) => {
                      const usage = (shift1Data.compressorClosingRPM || 0) - (shift1Data.compressorOpeningRPM || 0);
                      return (
                        <div style={{ fontSize: '10px' }}>
                          <div>Start: {truncateToFixed(record.startingRPM || 0, 1)}</div>
                          <div><b>Daily: +{truncateToFixed(usage, 1)} (Est)</b></div>
                        </div>
                      );
                    }
                  },
                  {
                    title: 'Action',
                    key: 'action',
                    width: '20%',
                    render: (_, record) => {
                      const isRemoved = record.action === 'remove';
                      return (
                        <Button
                          danger
                          size="small"
                          type={isRemoved ? 'default' : 'primary'}
                          ghost
                          onClick={() => {
                            if (record.action === 'fit') {
                              setShift1Data(prev => ({ ...prev, drillingTools: prev.drillingTools.filter(t => t.itemId !== record.itemId) }));
                            } else if (isRemoved) {
                              setShift1Data(prev => ({
                                ...prev,
                                drillingTools: prev.drillingTools.map(t => t.itemId === record.itemId ? { ...t, action: 'update' } : t)
                              }));
                            } else {
                              setShift1Data(prev => ({
                                ...prev,
                                drillingTools: prev.drillingTools.map(t => t.itemId === record.itemId ? { ...t, action: 'remove' } : t)
                              }));
                            }
                          }}
                          style={{ fontSize: '10px' }}
                        >
                          {isRemoved ? 'Undo' : 'Remove'}
                        </Button>
                      );
                    }
                  }
                ]}
                style={{ fontSize: '11px', marginTop: '4px' }}
              />
            </div>

            {/* Validation Warnings */}
            {validationWarnings.length > 0 && (
              <div style={{ marginTop: '4px', marginBottom: '4px' }}>
                {validationWarnings.map((warning, idx) => (
                  <div key={idx} style={{ color: 'red', fontSize: '11px', marginBottom: '2px' }}>
                    {warning}
                  </div>
                ))}
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', marginTop: '4px' }}>
              <Button
                type="primary"
                onClick={handleSubmit}
                loading={submitting}
                size="small"
                style={{ height: '28px', fontSize: '11px' }}
              >
                Save Daily Entries
              </Button>
              <Button onClick={handleCancel} size="small" style={{ height: '28px', fontSize: '11px' }}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Daily Entries Table */}
      <Card>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col>
            <Space>
              <Text strong>Filter by Date Range:</Text>
              <DatePicker.RangePicker
                value={dateRange}
                onChange={(dates) => {
                  setDateRange(dates || [null, null]);
                  // Reset pagination to page 1 when date range changes
                  setPagination(prev => ({ ...prev, current: 1 }));
                }}
                format="DD/MM/YYYY"
                allowClear
              />
              <Text strong>Filter by Site:</Text>
              <Select
                placeholder="Select site"
                value={selectedSite || undefined}
                onChange={(value) => {
                  setSelectedSite(value || undefined);
                  // Reset pagination to page 1 when site filter changes
                  setPagination(prev => ({ ...prev, current: 1 }));
                }}
                allowClear
                showSearch
                optionFilterProp="children"
                style={{ minWidth: 200 }}
              >
                {sites.map(site => (
                  <Select.Option key={site.id} value={site.id}>
                    {site.siteName}
                  </Select.Option>
                ))}
              </Select>
              {(dateRange[0] && dateRange[1]) || selectedSite ? (
                <Button
                  size="small"
                  onClick={() => {
                    setDateRange([null, null]);
                    setSelectedSite(null);
                    setPagination(prev => ({ ...prev, current: 1 }));
                  }}
                >
                  Clear Filter
                </Button>
              ) : null}
            </Space>
          </Col>
        </Row>
        <Table
          columns={columns}
          dataSource={entries}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            onChange: (page, pageSize) => {
              setPagination(prev => ({ ...prev, current: page, pageSize: pageSize || prev.pageSize }));
            },
            onShowSizeChange: (current, size) => {
              setPagination(prev => ({ ...prev, current: 1, pageSize: size }));
            },
          }}
          size="middle"
        />
      </Card>

      {/* Service Name Modal */}


      {/* Edit Daily Entry Modal */}
      <EditDailyEntry
        visible={showEditModal}
        onCancel={() => {
          setShowEditModal(false);
          setEditingShift1Id(null);
          setEditingShift2Id(null);
        }}
        onSuccess={() => {
          refetchEntries();
        }}
        shift1EntryId={editingShift1Id}
        shift2EntryId={editingShift2Id}
        entries={entries}
      />
    </div>
  );
};

export default DailyEntry;

