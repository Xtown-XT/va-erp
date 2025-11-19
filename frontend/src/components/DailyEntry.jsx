import { useState, useEffect, useRef } from "react";
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
  useVehicles, 
  useCompressors, 
  useEmployees, 
  useDailyEntries,
  useFittedDrillingTools
} from "../hooks/useQueries";
import { useCreateDailyEntry, useDeleteDailyEntry } from "../hooks/useMutations";
import { useItemsByType } from "../hooks/useQueries";

const { Title, Text } = Typography;
const { Panel } = Collapse;

const DailyEntry = () => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    pageSizeOptions: ['10', '20', '50'],
  });
  
  // React Query hooks - use pagination state directly
  const { data: entriesData = { data: [], total: 0, page: 1, limit: 10 }, isLoading: loading, refetch: refetchEntries } = useDailyEntries({ 
    page: pagination.current, 
    limit: pagination.pageSize 
  });
  const { data: sites = [] } = useSites();
  const { data: machines = [] } = useVehicles();
  const { data: compressors = [] } = useCompressors();
  const { data: employees = [] } = useEmployees();
  
  // Mutations
  const createDailyEntry = useCreateDailyEntry();
  const deleteDailyEntry = useDeleteDailyEntry();
  
  const entries = entriesData.data || [];
  
  // Shift 1 state
  const [shift1Data, setShift1Data] = useState({
    siteId: null,
    vehicleId: null, // DB column kept
    compressorId: null,
    vehicleOpeningRPM: null, // Changed to null for placeholder
    vehicleClosingRPM: null, // Changed to null for placeholder
    compressorOpeningRPM: null, // Changed to null for placeholder
    compressorClosingRPM: null, // Changed to null for placeholder
    vehicleHSD: null, // Changed to null for placeholder
    compressorHSD: null, // Changed to null for placeholder
    dieselUsed: null, // Changed to null for placeholder
    noOfHoles: null, // Changed to null for placeholder
    meter: null, // Changed to null for placeholder
    employees: [
      { id: Date.now(), role: 'operator', employeeId: null },
      { id: Date.now() + 1, role: 'helper', employeeId: null }
    ],
    machineSpares: [], // Machine spares added
    compressorSpares: [], // Compressor spares added
    drillingTools: [], // Drilling tools added
  });
  
  // Shift 2 state  
  const [shift2Data, setShift2Data] = useState({
    siteId: null,
    vehicleId: null, // DB column kept
    compressorId: null,
    vehicleOpeningRPM: null, // Changed to null for placeholder
    vehicleClosingRPM: null, // Changed to null for placeholder
    compressorOpeningRPM: null, // Changed to null for placeholder
    compressorClosingRPM: null, // Changed to null for placeholder
    vehicleHSD: null, // Changed to null for placeholder
    compressorHSD: null, // Changed to null for placeholder
    dieselUsed: null, // Changed to null for placeholder
    noOfHoles: null, // Changed to null for placeholder
    meter: null, // Changed to null for placeholder
    employees: [
      { id: Date.now() + 2, role: 'operator', employeeId: null },
      { id: Date.now() + 3, role: 'helper', employeeId: null }
    ],
    machineSpares: [], // Machine spares added
    compressorSpares: [], // Compressor spares added
    drillingTools: [], // Drilling tools added
  });
  
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [shift1Enabled, setShift1Enabled] = useState(true);
  const [shift2Enabled, setShift2Enabled] = useState(true); // Always enabled
  const [selectedShift1Machine, setSelectedShift1Machine] = useState(null);
  const [selectedShift2Machine, setSelectedShift2Machine] = useState(null);
  const [selectedShift1Compressor, setSelectedShift1Compressor] = useState(null);
  const [selectedShift2Compressor, setSelectedShift2Compressor] = useState(null);
  const [validationWarnings, setValidationWarnings] = useState([]);
  
  // Inline item selection state
  const [showMachineSparesSelector, setShowMachineSparesSelector] = useState(false);
  const [showCompressorSparesSelector, setShowCompressorSparesSelector] = useState(false);
  const [showDrillingToolsSelector, setShowDrillingToolsSelector] = useState(false);
  const [serviceNameInput, setServiceNameInput] = useState("");
  const [showServiceNameModal, setShowServiceNameModal] = useState(false);
  const [pendingSpareType, setPendingSpareType] = useState(null); // 'machine' or 'compressor'

  // Fetch existing fitted drilling tools when compressor is selected
  const { data: existingDrillingTools = [] } = useFittedDrillingTools(selectedShift1Compressor?.id || null);

  // Update pagination when entries data changes
  useEffect(() => {
    setPagination(prev => ({
      ...prev,
      current: entriesData.page || prev.current,
      total: entriesData.total || 0,
      pageSize: entriesData.limit || prev.pageSize,
    }));
  }, [entriesData]);

  // Auto-populate existing drilling tools when compressor is selected
  useEffect(() => {
    if (existingDrillingTools.length > 0 && selectedShift1Compressor) {
      setShift1Data(prev => {
        // Check which existing tools are not yet in the state
        const existingToolIds = new Set(prev.drillingTools.filter(t => t.isExisting).map(t => t.itemServiceId));
        const newTools = existingDrillingTools
          .filter(tool => !existingToolIds.has(tool.itemServiceId || tool.id))
          .map(tool => ({
            id: tool.itemServiceId || tool.id,
            itemServiceId: tool.itemServiceId || tool.id,
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
          }));
        
        if (newTools.length > 0) {
          return {
            ...prev,
            drillingTools: [...prev.drillingTools, ...newTools]
          };
        }
        return prev;
      });
    } else if (!selectedShift1Compressor) {
      // Clear existing drilling tools if compressor is deselected
      setShift1Data(prev => ({
        ...prev,
        drillingTools: prev.drillingTools.filter(t => !t.isExisting)
      }));
    }
  }, [existingDrillingTools, selectedShift1Compressor?.id]);

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
  const handleMachineChange = (machineId, shift) => {
    const machine = machines.find(m => m.id === machineId);
    
    if (shift === 1) {
      setSelectedShift1Machine(machine);
      setShift1Data(prev => ({
        ...prev,
        vehicleId: machineId,
        vehicleOpeningRPM: machine?.vehicleRPM || null, // Auto-fill from machine current RPM
        compressorId: machine?.compressorId || null,
      }));
      
      if (machine?.compressorId) {
        const compressor = compressors.find(c => c.id === machine.compressorId);
        setSelectedShift1Compressor(compressor);
        setShift1Data(prev => ({
          ...prev,
          compressorOpeningRPM: compressor?.compressorRPM || null, // Auto-fill from compressor current RPM
        }));
      } else {
        setSelectedShift1Compressor(null);
        setShift1Data(prev => ({
          ...prev,
          compressorOpeningRPM: null,
        }));
      }
      
      // Sync machine, compressor, and site from Shift 1 to Shift 2
      setSelectedShift2Machine(machine);
      if (machine?.compressorId) {
        const compressor = compressors.find(c => c.id === machine.compressorId);
        setSelectedShift2Compressor(compressor);
      } else {
        setSelectedShift2Compressor(null);
      }
      
      // Sync Shift 2 data - use Shift 1's closing RPM if set, otherwise use machine's current RPM
      const shouldAutoFill = shift1Data.vehicleClosingRPM === null;
      setShift2Data(prev => ({
        ...prev,
        vehicleId: machineId,
        compressorId: machine?.compressorId || null,
        siteId: shift1Data.siteId || prev.siteId, // Sync site from Shift 1
        vehicleOpeningRPM: shouldAutoFill ? (machine?.vehicleRPM || null) : prev.vehicleOpeningRPM,
        compressorOpeningRPM: shouldAutoFill 
          ? (machine?.compressorId ? compressors.find(c => c.id === machine.compressorId)?.compressorRPM || null : null)
          : prev.compressorOpeningRPM,
      }));
    } else {
      // Shift 2 machine selection - UI allows changes but save will use Shift 1's machine
      setSelectedShift2Machine(machine);
      // Only auto-fill if Shift 1 closing RPM hasn't been set yet
      const shouldAutoFill = shift1Data.vehicleClosingRPM === null;
      setShift2Data(prev => ({
        ...prev,
        vehicleId: machineId, // UI can change, but save will override with Shift 1's vehicleId
        vehicleOpeningRPM: shouldAutoFill ? (machine?.vehicleRPM || null) : prev.vehicleOpeningRPM,
        compressorId: machine?.compressorId || null,
      }));
      
      if (machine?.compressorId) {
        const compressor = compressors.find(c => c.id === machine.compressorId);
        setSelectedShift2Compressor(compressor);
        setShift2Data(prev => ({
          ...prev,
          compressorOpeningRPM: shouldAutoFill ? (compressor?.compressorRPM || null) : prev.compressorOpeningRPM, // Auto-fill from compressor or keep Shift 1 closing
        }));
      } else {
        setSelectedShift2Compressor(null);
        setShift2Data(prev => ({
          ...prev,
          compressorOpeningRPM: null,
        }));
      }
    }
  };
  
  // Auto-fill Shift 2 opening when Shift 1 closing changes (removed - now handled directly in onChange)

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

  // Handle Add Machine Spares button click - prompt for service name first
  const handleAddMachineSparesClick = () => {
    if (!selectedShift1Machine?.vehicleNumber) {
      message.warning("Please select a machine first");
      return;
    }
    setPendingSpareType('machine');
    setShowServiceNameModal(true);
  };

  // Handle Add Compressor Spares button click - prompt for service name first
  const handleAddCompressorSparesClick = () => {
    if (!selectedShift1Compressor?.compressorName) {
      message.warning("Please select a compressor first");
      return;
    }
    setPendingSpareType('compressor');
    setShowServiceNameModal(true);
  };

  // Handle Add Drilling Tools button click - no service name needed
  const handleAddDrillingToolsClick = () => {
    if (!selectedShift1Compressor?.compressorName) {
      message.warning("Please select a compressor first");
      return;
    }
    setShowDrillingToolsSelector(true);
  };

  // Confirm service name and show item selector
  const handleServiceNameConfirm = () => {
    if (!serviceNameInput.trim()) {
      message.warning("Please enter a service name");
      return;
    }
    setShowServiceNameModal(false);
    if (pendingSpareType === 'machine') {
      setShowMachineSparesSelector(true);
    } else if (pendingSpareType === 'compressor') {
      setShowCompressorSparesSelector(true);
    }
    // Don't clear serviceNameInput - keep it for adding multiple items
  };

  // Add machine spare item
  const handleAddMachineSpare = (item, quantity, serviceName) => {
    const currentBalance = item.balance ?? 0;
    if (quantity <= 0 || quantity > currentBalance) {
      message.error(`Invalid quantity. Available: ${currentBalance}, Required: ${quantity}`);
      return;
    }
    const newSpare = {
      id: Date.now() + Math.random(),
      itemId: item.id,
      itemName: item.itemName,
      partNumber: item.partNumber,
      quantity: quantity,
      serviceName: serviceName.trim(),
      addedDate: selectedDate.format("YYYY-MM-DD"),
      balance: item.balance
    };
    setShift1Data(prev => ({
      ...prev,
      machineSpares: [...prev.machineSpares, newSpare]
    }));
    message.success(`${item.itemName} added to machine spares`);
  };

  // Add compressor spare item
  const handleAddCompressorSpare = (item, quantity, serviceName) => {
    const currentBalance = item.balance ?? 0;
    if (quantity <= 0 || quantity > currentBalance) {
      message.error(`Invalid quantity. Available: ${currentBalance}, Required: ${quantity}`);
      return;
    }
    const newSpare = {
      id: Date.now() + Math.random(),
      itemId: item.id,
      itemName: item.itemName,
      partNumber: item.partNumber,
      quantity: quantity,
      serviceName: serviceName.trim(),
      addedDate: selectedDate.format("YYYY-MM-DD"),
      balance: item.balance
    };
    setShift1Data(prev => ({
      ...prev,
      compressorSpares: [...prev.compressorSpares, newSpare]
    }));
    message.success(`${item.itemName} added to compressor spares`);
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

  // Remove machine spare (no stock restoration)
  const handleRemoveMachineSpare = (spareId) => {
    setShift1Data(prev => ({
      ...prev,
      machineSpares: prev.machineSpares.filter(s => s.id !== spareId)
    }));
  };

  // Remove compressor spare (no stock restoration)
  const handleRemoveCompressorSpare = (spareId) => {
    setShift1Data(prev => ({
      ...prev,
      compressorSpares: prev.compressorSpares.filter(s => s.id !== spareId)
    }));
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
      const shift2VehicleId = shift1Data.vehicleId;
      const shift2CompressorId = shift1Data.compressorId; // Compressor also same as Shift 1
      
      const warnings = [];
      
      // Collect validation warnings (non-blocking)
      if (shift1Enabled) {
        const shift1Operators = shift1Data.employees.filter(e => e.role === 'operator' && e.employeeId);
        if (shift1Operators.length === 0) {
          warnings.push("Shift 1: No operator selected");
        }
        if (!shift1Data.siteId) {
          warnings.push("Shift 1: Site not selected");
        }
        if (!shift1Data.vehicleId) {
          warnings.push("Shift 1: Machine not selected");
        }
      }
      
      // Validate Shift 2 (always enabled)
      // Shift 2 uses same site and machine as Shift 1, so only validate operator
      const shift2Operators = shift2Data.employees.filter(e => e.role === 'operator' && e.employeeId);
      if (shift2Operators.length === 0) {
        warnings.push("Shift 2: No operator selected");
      }
      // Validate that Shift 1 has site and machine (since Shift 2 uses the same)
      if (!shift1Data.siteId) {
        warnings.push("Shift 2: Site not selected (uses Shift 1's site)");
      }
      if (!shift1Data.vehicleId) {
        warnings.push("Shift 2: Machine not selected (uses Shift 1's machine)");
      }
      
      // Display warnings if any and prevent submission
      if (warnings.length > 0) {
        setValidationWarnings(warnings);
        setSubmitting(false);
        message.error("Please fix the validation errors before submitting");
        return;
      }
      
      // Generate ref numbers sequentially upfront to ensure unique sequential numbers
      let refNo1 = null;
      let refNo2 = null;
      if (shift1Enabled) {
        refNo1 = await generateRefNoHelper();
      }
      refNo2 = await generateRefNoHelper(); // Always generate for Shift 2

      // Helper function to clean null values from payload (convert to undefined)
      const cleanPayload = (payload) => {
        const cleaned = { ...payload };
        // Convert null to undefined for optional fields so they're omitted from JSON
        if (cleaned.siteId === null) delete cleaned.siteId;
        if (cleaned.vehicleId === null) delete cleaned.vehicleId;
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
          const payload1 = cleanPayload({
            refNo: refNo1,
            date: dateStr,
            shift: 1,
            siteId: shift1Data.siteId,
            vehicleId: shift1Data.vehicleId,
            compressorId: shift1Data.compressorId,
            vehicleOpeningRPM: shift1Data.vehicleOpeningRPM ?? 0,
            vehicleClosingRPM: shift1Data.vehicleClosingRPM ?? 0,
            compressorOpeningRPM: shift1Data.compressorOpeningRPM ?? 0,
            compressorClosingRPM: shift1Data.compressorClosingRPM ?? 0,
            dieselUsed: shift1Data.dieselUsed ?? 0,
            vehicleHSD: shift1Data.vehicleHSD ?? 0,
            compressorHSD: shift1Data.compressorHSD ?? 0,
            noOfHoles: shift1Data.noOfHoles ?? 0,
            meter: shift1Data.meter ?? 0,
            employees: shift1Data.employees
              .filter(e => e.employeeId)
              .map(e => ({ employeeId: e.employeeId, role: e.role, shift: 1 })),
            notes: "",
            // New spares structure
            machineSpares: shift1Data.machineSpares || [],
            compressorSpares: shift1Data.compressorSpares || [],
            drillingTools: prepareDrillingToolsPayload(shift1Data.drillingTools || []),
          });
          
          await createDailyEntry.mutateAsync(payload1);
        } catch (error) {
          message.error(`Failed to save Shift 1: ${error?.response?.data?.message || error?.message || 'Unknown error'}`);
          setSubmitting(false);
          return;
        }
      }

      // Save Shift 2 (always enabled)
      // Shift 2 uses same siteId, vehicleId, and compressorId as Shift 1
      // Only RPM, meter, holes, and employees differ between shifts
      // Note: Drilling tools are only sent in Shift 1 payload since daily RPM/meter is calculated from both shifts
      try {
        const payload2 = cleanPayload({
          refNo: refNo2,
          date: dateStr,
          shift: 2,
          siteId: shift2SiteId, // Always use Shift 1's siteId
          vehicleId: shift2VehicleId, // Always use Shift 1's vehicleId
          compressorId: shift2CompressorId, // Always use Shift 1's compressorId
          vehicleOpeningRPM: shift2Data.vehicleOpeningRPM ?? 0,
          vehicleClosingRPM: shift2Data.vehicleClosingRPM ?? 0,
          compressorOpeningRPM: shift2Data.compressorOpeningRPM ?? 0,
          compressorClosingRPM: shift2Data.compressorClosingRPM ?? 0,
          dieselUsed: shift2Data.dieselUsed ?? 0,
          vehicleHSD: shift2Data.vehicleHSD ?? 0,
          compressorHSD: shift2Data.compressorHSD ?? 0,
          noOfHoles: shift2Data.noOfHoles ?? 0,
          meter: shift2Data.meter ?? 0,
          employees: shift2Data.employees
            .filter(e => e.employeeId)
            .map(e => ({ employeeId: e.employeeId, role: e.role, shift: 2 })),
          notes: "",
          // New spares structure
          machineSpares: shift2Data.machineSpares || [],
          compressorSpares: shift2Data.compressorSpares || [],
          // Drilling tools not sent in Shift 2 - handled in Shift 1 with combined RPM/meter
        });
        
        await createDailyEntry.mutateAsync(payload2);
      } catch (error) {
        message.error(`Failed to save Shift 2: ${error?.response?.data?.message || error?.message || 'Unknown error'}`);
        setSubmitting(false);
        return;
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
    setValidationWarnings([]); // Clear warnings on cancel
    setShift1Enabled(true);
    setShift2Enabled(false);
    setShift1Data({
      siteId: null,
      vehicleId: null,
      compressorId: null,
      vehicleOpeningRPM: 0,
      vehicleClosingRPM: 0,
      compressorOpeningRPM: 0,
      compressorClosingRPM: 0,
      vehicleHSD: 0,
      compressorHSD: 0,
      dieselUsed: 0,
      noOfHoles: 0,
      meter: 0,
      employees: [],
      machineSpares: [],
      compressorSpares: [],
      drillingTools: [],
    });
    setShift2Data({
      siteId: null,
      vehicleId: null,
      compressorId: null,
      vehicleOpeningRPM: 0,
      vehicleClosingRPM: 0,
      compressorOpeningRPM: 0,
      compressorClosingRPM: 0,
      vehicleHSD: 0,
      compressorHSD: 0,
      dieselUsed: 0,
      noOfHoles: 0,
      meter: 0,
      employees: [],
      machineSpares: [],
      compressorSpares: [],
      drillingTools: [],
    });
    setSelectedShift1Machine(null);
    setSelectedShift2Machine(null);
    setSelectedShift1Compressor(null);
    setSelectedShift2Compressor(null);
  };

  // Handle delete
  const handleDelete = async (id) => {
    deleteDailyEntry.mutate(id);
  };

  // Render shift section
  const renderShiftSection = (shift, shiftData, selectedMachine, selectedCompressor) => {
    const updateShiftData = (field, value) => {
      if (shift === 1) {
        setShift1Data(prev => ({ ...prev, [field]: value }));
      } else {
        setShift2Data(prev => ({ ...prev, [field]: value }));
      }
    };

    const vehicleRPMDiff = (shiftData.vehicleClosingRPM || 0) - (shiftData.vehicleOpeningRPM || 0);
    const compressorRPMDiff = (shiftData.compressorClosingRPM || 0) - (shiftData.compressorOpeningRPM || 0);

    return (
      <Card 
        title={`Shift ${shift}`} 
        className="mb-4"
      >
        {((shift === 1 && shift1Enabled) || (shift === 2 && shift2Enabled)) && (
          <>
            {/* Basic Info */}
            <div className="mb-4">
              <Title level={5}>Basic Information</Title>
              <Row gutter={16}>
                <Col xs={24} sm={8}>
                  <Text strong>Site *</Text>
                  <Select
                    className="w-full mt-1"
                    placeholder="Select site"
                    value={shiftData.siteId}
                    onChange={(value) => updateShiftData('siteId', value)}
                    showSearch
                    optionFilterProp="children"
                  >
                    {sites.map(site => (
                      <Select.Option key={site.id} value={site.id}>
                        {site.siteName}
                      </Select.Option>
                    ))}
                  </Select>
                </Col>
                <Col xs={24} sm={8}>
                  <Text strong>Machine *</Text>
                  <Select
                    className="w-full mt-1"
                    placeholder="Select machine"
                    value={shiftData.vehicleId}
                    onChange={(value) => handleMachineChange(value, shift)}
                    showSearch
                    optionFilterProp="children"
                  >
                    {machines
                      .filter(machine => !shiftData.siteId || machine.siteId === shiftData.siteId)
                      .map(machine => (
                        <Select.Option key={machine.id} value={machine.id}>
                          {machine.vehicleType} ({machine.vehicleNumber})
                        </Select.Option>
                      ))}
                  </Select>
                </Col>
                <Col xs={24} sm={8}>
                  <Text strong>Compressor</Text>
                  <Select
                    className="w-full mt-1"
                    placeholder="Select compressor"
                    value={shiftData.compressorId}
                    onChange={(value) => updateShiftData('compressorId', value)}
                    showSearch
                    optionFilterProp="children"
                    allowClear
                  >
                    {compressors.map(compressor => (
                      <Select.Option key={compressor.id} value={compressor.id}>
                        {compressor.compressorName}
                      </Select.Option>
                    ))}
                  </Select>
                </Col>
              </Row>
            </div>

            {/* Service Details Display */}
            {selectedMachine && (
              <Alert
                message="Service Details"
                description={
                  <div>
                    <Text><strong>Machine Current RPM:</strong> {truncateToFixed(selectedMachine.vehicleRPM || 0, 2)}</Text><br />
                    <Text><strong>Machine Next Service:</strong> {selectedMachine.nextServiceRPM || 'Not set'}</Text><br />
                    {selectedCompressor && (
                      <>
                        <Text><strong>Compressor Current RPM:</strong> {truncateToFixed(selectedCompressor.compressorRPM || 0, 2)}</Text><br />
                        <Text><strong>Compressor Next Service:</strong> {selectedCompressor.nextServiceRPM || 'Not set'}</Text>
                      </>
                    )}
                  </div>
                }
                type="info"
                className="mb-4"
              />
            )}

            {/* RPM Tracking */}
            <div className="mb-4">
              <Title level={5}>RPM Tracking</Title>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Card title="Machine RPM" size="small">
                    <Row gutter={8}>
                      <Col span={12}>
                        <Text strong>Opening</Text>
                        <InputNumber
                          className="w-full mt-1"
                          value={shiftData.vehicleOpeningRPM}
                          onChange={(value) => updateShiftData('vehicleOpeningRPM', value)}
                          min={0}
                          step={0.1}
                          precision={1}
                          controls={false}
                        />
                      </Col>
                      <Col span={12}>
                        <Text strong>Closing</Text>
                        <InputNumber
                          className="w-full mt-1"
                          value={shiftData.vehicleClosingRPM}
                          onChange={(value) => {
                            updateShiftData('vehicleClosingRPM', value);
                            // Auto-fill Shift 2 opening when Shift 1 closing is typed
                            if (shift === 1) {
                              setShift2Data(prev => ({ ...prev, vehicleOpeningRPM: value }));
                            }
                          }}
                          min={0}
                          step={0.1}
                          precision={1}
                          controls={false}
                        />
                      </Col>
                    </Row>
                    <div className="text-center mt-2">
                      <Text strong>Total: {truncateToFixed(vehicleRPMDiff, 2)} RPM</Text>
                    </div>
                  </Card>
                </Col>
                <Col xs={24} sm={12}>
                  <Card title="Compressor RPM" size="small">
                    <Row gutter={8}>
                      <Col span={12}>
                        <Text strong>Opening</Text>
                        <InputNumber
                          className="w-full mt-1"
                          value={shiftData.compressorOpeningRPM}
                          onChange={(value) => updateShiftData('compressorOpeningRPM', value)}
                          min={0}
                          step={0.1}
                          precision={1}
                          controls={false}
                        />
                      </Col>
                      <Col span={12}>
                        <Text strong>Closing</Text>
                        <InputNumber
                          className="w-full mt-1"
                          value={shiftData.compressorClosingRPM}
                          onChange={(value) => {
                            updateShiftData('compressorClosingRPM', value);
                            // Auto-fill Shift 2 opening when Shift 1 closing is typed
                            if (shift === 1) {
                              setShift2Data(prev => ({ ...prev, compressorOpeningRPM: value }));
                            }
                          }}
                          min={0}
                          step={0.1}
                          precision={1}
                          controls={false}
                        />
                      </Col>
                    </Row>
                    <div className="text-center mt-2">
                      <Text strong>Total: {truncateToFixed(compressorRPMDiff, 2)} RPM</Text>
                    </div>
                  </Card>
                </Col>
              </Row>
            </div>

            {/* NEW: Service Management */}
            {selectedMachine && (
              <div className="mb-4">
                <Title level={5}>Service Management</Title>
                <Row gutter={16}>
                  <Col xs={24} sm={8}>
                    <Button
                      type={shiftData.vehicleServiceDone ? "primary" : "default"}
                      icon={<SettingOutlined />}
                      onClick={() => {
                        setCurrentServiceShift(shift);
                        setShowMachineServiceModal(true);
                      }}
                      block
                      disabled={!shiftData.vehicleId}
                    >
                      {shiftData.vehicleServiceDone ? '✓ ' : ''}Machine Service
                      {shiftData.machineServiceItems?.length > 0 && ` (${shiftData.machineServiceItems.length} items)`}
                    </Button>
                  </Col>
                  {selectedCompressor && (
                    <>
                      <Col xs={24} sm={8}>
                        <Button
                          type={shiftData.compressorServiceDone ? "primary" : "default"}
                          icon={<SettingOutlined />}
                          onClick={() => {
                            setCurrentServiceShift(shift);
                            setShowCompressorServiceModal(true);
                          }}
                          block
                          disabled={!shiftData.compressorId}
                        >
                          {shiftData.compressorServiceDone ? '✓ ' : ''}Compressor Service
                          {shiftData.compressorServiceItems?.length > 0 && ` (${shiftData.compressorServiceItems.length} items)`}
                        </Button>
                      </Col>
                      <Col xs={24} sm={8}>
                        <Button
                          type="dashed"
                          icon={<ToolOutlined />}
                          onClick={() => {
                            setCurrentServiceShift(shift);
                            setShowDrillingToolsModal(true);
                          }}
                          block
                          disabled={!shiftData.compressorId}
                        >
                          Drilling Tools
                          {shiftData.drillingTools?.length > 0 && ` (${shiftData.drillingTools.length})`}
                        </Button>
                      </Col>
                    </>
                  )}
                </Row>
                
                {/* Show selected service items summary */}
                {shiftData.machineServiceItems?.length > 0 && (
                  <Alert
                    message="Machine Service Items"
                    description={
                      <div>
                        {shiftData.machineServiceItems.map((item, idx) => (
                          <div key={idx}>
                            • {item.itemName} ({item.partNumber}) - Qty: {item.quantity}
                          </div>
                        ))}
                      </div>
                    }
                    type="success"
                    className="mt-2"
                    closable
                    onClose={() => updateShiftData('machineServiceItems', [])}
                  />
                )}
                {shiftData.compressorServiceItems?.length > 0 && (
                  <Alert
                    message="Compressor Service Items"
                    description={
                      <div>
                        {shiftData.compressorServiceItems.map((item, idx) => (
                          <div key={idx}>
                            • {item.itemName} ({item.partNumber}) - Qty: {item.quantity}
                          </div>
                        ))}
                      </div>
                    }
                    type="success"
                    className="mt-2"
                    closable
                    onClose={() => updateShiftData('compressorServiceItems', [])}
                  />
                )}
                {shiftData.drillingTools?.length > 0 && (
                  <Alert
                    message="Drilling Tools"
                    description={
                      <div>
                        {shiftData.drillingTools.map((tool, idx) => (
                          <div key={idx}>
                            • {tool.itemName} - {tool.action === 'fit' ? `Fitted at ${tool.startingRPM} RPM` : `Removed at ${tool.endingRPM} RPM`}
                          </div>
                        ))}
                      </div>
                    }
                    type="info"
                    className="mt-2"
                    closable
                    onClose={() => updateShiftData('drillingTools', [])}
                  />
                )}
              </div>
            )}

            {/* HSD and Production */}
            <div className="mb-4">
              <Title level={5}>HSD & Production</Title>
              <Row gutter={16}>
                <Col xs={24} sm={6}>
                  <Text strong>Vehicle HSD</Text>
                  <InputNumber
                    className="w-full mt-1"
                    value={shiftData.vehicleHSD}
                    onChange={(value) => updateShiftData('vehicleHSD', value)}
                    min={0}
                    step={0.1}
                    precision={1}
                    controls={false}
                  />
                </Col>
                <Col xs={24} sm={6}>
                  <Text strong>Compressor HSD</Text>
                  <InputNumber
                    className="w-full mt-1"
                    value={shiftData.compressorHSD}
                    onChange={(value) => updateShiftData('compressorHSD', value)}
                    min={0}
                    step={0.1}
                    precision={1}
                    controls={false}
                  />
                </Col>
                <Col xs={24} sm={6}>
                  <Text strong>No. of Holes</Text>
                  <InputNumber
                    className="w-full mt-1"
                    value={shiftData.noOfHoles}
                    onChange={(value) => updateShiftData('noOfHoles', value)}
                    min={0}
                    controls={false}
                  />
                </Col>
              </Row>
              <Row gutter={16} className="mt-3">
                <Col xs={24} sm={6}>
                  <Text strong>Total Meter</Text>
                  <InputNumber
                    className="w-full mt-1"
                    value={shiftData.meter}
                    onChange={(value) => updateShiftData('meter', value)}
                    min={0}
                    step={0.1}
                    precision={1}
                    controls={false}
                  />
                </Col>
              </Row>
            </div>

            {/* Employees */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <Title level={5}>Employees</Title>
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => addEmployeeToShift(shift)}
                >
                  Add Employee
                </Button>
              </div>
              {shiftData.employees.map((emp) => (
                <Row gutter={16} key={emp.id} className="mb-2">
                  <Col xs={24} sm={8}>
                    <Select
                      placeholder="Select role"
                      value={emp.role}
                      onChange={(value) => updateEmployeeInShift(shift, emp.id, 'role', value)}
                      className="w-full"
                    >
                      <Select.Option value="operator">Operator</Select.Option>
                      <Select.Option value="helper">Helper</Select.Option>
                    </Select>
                  </Col>
                  <Col xs={24} sm={14}>
                    <Select
                      placeholder={`Select ${emp.role}`}
                      value={emp.employeeId}
                      onChange={(value) => updateEmployeeInShift(shift, emp.id, 'employeeId', value)}
                      showSearch
                      optionFilterProp="children"
                      className="w-full"
                    >
                      {employees.map(employee => (
                        <Select.Option key={employee.id} value={employee.id}>
                          {employee.name} ({employee.empId}){employee.designation ? ` - ${employee.designation}` : ''}
                        </Select.Option>
                      ))}
                    </Select>
                  </Col>
                  <Col xs={24} sm={2}>
                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => removeEmployeeFromShift(shift, emp.id)}
                    />
                  </Col>
                </Row>
              ))}
            </div>

            {/* Fitted Items */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <Title level={5}>Fitted Machine Items (Spares)</Title>
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => openFitItemModal(shift)}
                >
                  Fit Item
                </Button>
              </div>
              <Table
                dataSource={shiftData.fittedItems}
                columns={[
                  { title: "Instance Number", dataIndex: "instanceNumber", key: "instanceNumber" },
                  { title: "Item Name", dataIndex: ["item", "itemName"], key: "itemName" },
                  { title: "Part Number", dataIndex: ["item", "partNumber"], key: "partNumber" },
                  { 
                    title: "Last Used Count (RPM)", 
                    key: "lastUsedCount",
                    render: (_, record) => truncateToFixed(record.lastUsedCount || record.currentRPM || 0, 2)
                  },
                  { 
                    title: "Balance", 
                    key: "balance",
                    render: (_, record) => record.balance || (record.status === 'in_stock' ? 1 : 0)
                  },
                  { 
                    title: "Current Count (RPM)", 
                    key: "currentCount",
                    render: (_, record) => truncateToFixed(record.currentCount || record.currentRPM || 0, 2)
                  },
                  {
                    title: "Actions",
                    key: "actions",
                    render: (_, record) => (
                      <Button
                        size="small"
                        danger
                        onClick={() => removeFittedItem(shift, record.id)}
                      >
                        Remove
                      </Button>
                    )
                  }
                ]}
                pagination={false}
                size="small"
                rowKey="id"
              />
            </div>

            {/* Service Status */}
            <div className="mb-4">
              <Title level={5}>Service Status</Title>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Text strong>Vehicle Service Done</Text>
                  <div className="mt-1">
                    <Switch
                      checked={shiftData.vehicleServiceDone}
                      onChange={(checked) => updateShiftData('vehicleServiceDone', checked)}
                      checkedChildren="Done"
                      unCheckedChildren="Pending"
                    />
                  </div>
                </Col>
                <Col xs={24} sm={12}>
                  <Text strong>Compressor Service Done</Text>
                  <div className="mt-1">
                    <Switch
                      checked={shiftData.compressorServiceDone}
                      onChange={(checked) => updateShiftData('compressorServiceDone', checked)}
                      checkedChildren="Done"
                      unCheckedChildren="Pending"
                    />
                  </div>
                </Col>
              </Row>
            </div>
          </>
        )}
      </Card>
    );
  };

  // Dropdown Selector Components
  const MachineSparesDropdown = ({ machineNumber, serviceName, onAdd, onClose }) => {
    const { data: items = [], isLoading } = useItemsByType(machineNumber);
    const [selectedItemId, setSelectedItemId] = useState(null);

    const selectedItem = items.find(i => i.id === selectedItemId);

    const handleAdd = () => {
      if (!selectedItem) {
        message.warning("Please select an item");
        return;
      }
      const currentBalance = selectedItem.balance ?? 0;
      if (currentBalance <= 0) {
        message.error("Item out of stock");
        return;
      }
      onAdd(selectedItem, 1); // Always add 1 count
      setSelectedItemId(null);
    };

    return (
      <Row gutter={[4, 4]} style={{ marginBottom: '4px' }}>
        <Col span={18}>
          <Select
            size="small"
            placeholder="Select item"
            value={selectedItemId}
            onChange={setSelectedItemId}
            showSearch
            style={{ width: '100%', fontSize: '11px' }}
            loading={isLoading}
            allowClear
          >
            {items.map(item => (
              <Select.Option 
                key={item.id} 
                value={item.id}
                disabled={(item.balance ?? 0) <= 0}
              >
                {item.itemName} ({item.balance})
              </Select.Option>
            ))}
          </Select>
        </Col>
        <Col span={6}>
          <Space>
            <Button
              size="small"
              type="primary"
              onClick={handleAdd}
                disabled={!selectedItem || (selectedItem.balance ?? 0) <= 0}
              style={{ fontSize: '11px' }}
            >
              Add
            </Button>
            <Button
              size="small"
              onClick={onClose}
              style={{ fontSize: '11px' }}
            >
              Cancel
            </Button>
          </Space>
        </Col>
      </Row>
    );
  };

  const CompressorSparesDropdown = ({ compressorName, serviceName, onAdd, onClose }) => {
    const { data: items = [], isLoading } = useItemsByType(compressorName);
    const [selectedItemId, setSelectedItemId] = useState(null);

    const selectedItem = items.find(i => i.id === selectedItemId);

    const handleAdd = () => {
      if (!selectedItem) {
        message.warning("Please select an item");
        return;
      }
      const currentBalance = selectedItem.balance ?? 0;
      if (currentBalance <= 0) {
        message.error("Item out of stock");
        return;
      }
      onAdd(selectedItem, 1); // Always add 1 count
      setSelectedItemId(null);
    };

    return (
      <Row gutter={[4, 4]} style={{ marginBottom: '4px' }}>
        <Col span={18}>
          <Select
            size="small"
            placeholder="Select item"
            value={selectedItemId}
            onChange={setSelectedItemId}
            showSearch
            style={{ width: '100%', fontSize: '11px' }}
            loading={isLoading}
            allowClear
          >
            {items.map(item => (
              <Select.Option 
                key={item.id} 
                value={item.id}
                disabled={(item.balance ?? 0) <= 0}
              >
                {item.itemName} ({item.balance})
              </Select.Option>
            ))}
          </Select>
        </Col>
        <Col span={6}>
          <Space>
            <Button
              size="small"
              type="primary"
              onClick={handleAdd}
                disabled={!selectedItem || (selectedItem.balance ?? 0) <= 0}
              style={{ fontSize: '11px' }}
            >
              Add
            </Button>
            <Button
              size="small"
              onClick={onClose}
              style={{ fontSize: '11px' }}
            >
              Cancel
            </Button>
          </Space>
        </Col>
      </Row>
    );
  };

  const DrillingToolsDropdown = ({ onAdd, onClose }) => {
    const { data: items = [], isLoading } = useItemsByType("Drilling Tools");
    const [selectedItemId, setSelectedItemId] = useState(null);

    const selectedItem = items.find(i => i.id === selectedItemId);

    const handleAdd = () => {
      if (!selectedItem) {
        message.warning("Please select an item");
        return;
      }
      const currentBalance = selectedItem.balance ?? 0;
      if (currentBalance <= 0) {
        message.error("Item out of stock");
        return;
      }
      onAdd(selectedItem, 1); // Always add 1 count
      setSelectedItemId(null);
    };

    return (
      <Row gutter={[4, 4]} style={{ marginBottom: '4px' }}>
        <Col span={18}>
          <Select
            size="small"
            placeholder="Select drilling tool"
            value={selectedItemId}
            onChange={setSelectedItemId}
            showSearch
            style={{ width: '100%', fontSize: '11px' }}
            loading={isLoading}
            allowClear
          >
            {items.map(item => (
              <Select.Option 
                key={item.id} 
                value={item.id}
                disabled={(item.balance ?? 0) <= 0}
              >
                {item.itemName} ({item.balance})
              </Select.Option>
            ))}
          </Select>
        </Col>
        <Col span={6}>
          <Space>
            <Button
              size="small"
              type="primary"
              onClick={handleAdd}
                disabled={!selectedItem || (selectedItem.balance ?? 0) <= 0}
              style={{ fontSize: '11px' }}
            >
              Add
            </Button>
            <Button
              size="small"
              onClick={onClose}
              style={{ fontSize: '11px' }}
            >
              Cancel
            </Button>
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
        const machine = record.vehicle || machines.find(m => m.id === record.vehicleId);
        if (!machine) return '-';
        return `${machine.vehicleType || 'Machine'} (${machine.vehicleNumber || ''})`;
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
                setShowForm(true);
                setSelectedDate(dayjs());
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
                    setShift1Data(prev => ({ ...prev, siteId: value }));
                    setShift2Data(prev => ({ ...prev, siteId: value })); // Always sync to Shift 2
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
                  value={shift1Data.vehicleId}
                  onChange={(value) => handleMachineChange(value, 1)}
                  showSearch
                  optionFilterProp="children"
                  style={{ fontSize: '11px' }}
                >
                  {machines.map(machine => (
                    <Select.Option key={machine.id} value={machine.id}>
                      {machine.vehicleType} ({machine.vehicleNumber})
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

            {/* Shift Data Table - Compact Table Format */}
            <Table
              size="small"
              pagination={false}
              dataSource={[
                { 
                  key: 'shift1', 
                  shift: 'Shift 1', 
                  data: shift1Data,
                  enabled: true // Always enabled
                },
                { 
                  key: 'shift2', 
                  shift: 'Shift 2', 
                  data: shift2Data,
                  enabled: true // Always enabled
                }
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
                      dataIndex: ['data', 'vehicleOpeningRPM'],
                      key: 'machineOpening',
                      width: 100,
                      render: (_, record) => (
                        <InputNumber
                          size="small"
                          placeholder="0.0"
                          value={record.data.vehicleOpeningRPM}
                          onChange={(value) => {
                            if (record.key === 'shift1') {
                              setShift1Data(prev => ({ ...prev, vehicleOpeningRPM: value }));
                            } else {
                              setShift2Data(prev => ({ ...prev, vehicleOpeningRPM: value }));
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
                      dataIndex: ['data', 'vehicleClosingRPM'],
                      key: 'machineClosing',
                      width: 100,
                      render: (_, record) => (
                        <InputNumber
                          size="small"
                          placeholder="0.0"
                          value={record.data.vehicleClosingRPM}
                          onChange={(value) => {
                            if (record.key === 'shift1') {
                              setShift1Data(prev => ({ ...prev, vehicleClosingRPM: value }));
                              // Auto-fill Shift 2 opening when Shift 1 closing is typed
                              setShift2Data(prev => ({ ...prev, vehicleOpeningRPM: value }));
                            } else {
                              setShift2Data(prev => ({ ...prev, vehicleClosingRPM: value }));
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
                              // Auto-fill Shift 2 opening when Shift 1 closing is typed
                              setShift2Data(prev => ({ ...prev, compressorOpeningRPM: value }));
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
                    const total = (record.data.vehicleClosingRPM || 0) - (record.data.vehicleOpeningRPM || 0);
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
                      value={record.data.vehicleHSD}
                      onChange={(value) => {
                        if (record.key === 'shift1') {
                          setShift1Data(prev => ({ ...prev, vehicleHSD: value }));
                        } else {
                          setShift2Data(prev => ({ ...prev, vehicleHSD: value }));
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
              <Col span={12}>
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
            </Row>

            {/* Spares Management Section */}
            <div style={{ marginBottom: '4px' }}>
              <Row gutter={[4, 4]} style={{ marginBottom: '4px' }}>
                <Col span={8}>
                  <Button
                    size="small"
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleAddMachineSparesClick}
                    disabled={!selectedShift1Machine}
                    block
                    style={{ fontSize: '11px', height: '28px' }}
                  >
                    Add Machine Spares
                  </Button>
                </Col>
                <Col span={8}>
                  <Button
                    size="small"
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleAddCompressorSparesClick}
                    disabled={!selectedShift1Compressor}
                    block
                    style={{ fontSize: '11px', height: '28px' }}
                  >
                    Add Compressor Spares
                  </Button>
                </Col>
                <Col span={8}>
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
              </Row>

              {/* Dropdown Selectors */}
              {showMachineSparesSelector && selectedShift1Machine && (
                <MachineSparesDropdown
                  machineNumber={selectedShift1Machine.vehicleNumber}
                  serviceName={serviceNameInput}
                  onAdd={(item, qty) => {
                    handleAddMachineSpare(item, qty, serviceNameInput);
                    setShowMachineSparesSelector(false);
                  }}
                  onClose={() => setShowMachineSparesSelector(false)}
                />
              )}
              {showCompressorSparesSelector && selectedShift1Compressor && (
                <CompressorSparesDropdown
                  compressorName={selectedShift1Compressor.compressorName}
                  serviceName={serviceNameInput}
                  onAdd={(item, qty) => {
                    handleAddCompressorSpare(item, qty, serviceNameInput);
                    setShowCompressorSparesSelector(false);
                  }}
                  onClose={() => setShowCompressorSparesSelector(false)}
                />
              )}
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
                dataSource={(() => {
                  // Combine all items into rows - find max length
                  const maxRows = Math.max(
                    shift1Data.machineSpares.length,
                    shift1Data.compressorSpares.length,
                    shift1Data.drillingTools.length
                  );
                  
                  const rows = [];
                  for (let i = 0; i < maxRows; i++) {
                    rows.push({
                      key: i,
                      machineSpare: shift1Data.machineSpares[i] || null,
                      compressorSpare: shift1Data.compressorSpares[i] || null,
                      drillingTool: shift1Data.drillingTools[i] || null,
                    });
                  }
                  return rows;
                })()}
                columns={[
                  {
                    title: 'Machine Spares',
                    key: 'machineSpares',
                    width: '33%',
                    render: (_, record) => {
                      if (!record.machineSpare) return null;
                      return (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontSize: '11px' }}>
                            {record.machineSpare.itemName} ({record.machineSpare.quantity})
                          </Text>
                          <Button
                            size="small"
                            danger
                            type="link"
                            icon={<DeleteOutlined />}
                            onClick={() => handleRemoveMachineSpare(record.machineSpare.id)}
                            style={{ fontSize: '11px', padding: '0 4px' }}
                          />
                        </div>
                      );
                    }
                  },
                  {
                    title: 'Compressor Spares',
                    key: 'compressorSpares',
                    width: '33%',
                    render: (_, record) => {
                      if (!record.compressorSpare) return null;
                      return (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontSize: '11px' }}>
                            {record.compressorSpare.itemName} ({record.compressorSpare.quantity})
                          </Text>
                          <Button
                            size="small"
                            danger
                            type="link"
                            icon={<DeleteOutlined />}
                            onClick={() => handleRemoveCompressorSpare(record.compressorSpare.id)}
                            style={{ fontSize: '11px', padding: '0 4px' }}
                          />
                        </div>
                      );
                    }
                  },
                  {
                    title: 'Drilling Tools',
                    key: 'drillingTools',
                    width: '34%',
                    render: (_, record) => {
                      if (!record.drillingTool) return null;
                      const isExisting = record.drillingTool.isExisting;
                      const isRemoved = record.drillingTool.action === 'remove';
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <Text style={{ fontSize: '11px', color: isRemoved ? '#999' : '#000' }}>
                                {record.drillingTool.itemName} - {record.drillingTool.partNumber}
                              </Text>
                              {isExisting && !isRemoved && (
                                <Tag size="small" style={{ marginLeft: '4px', fontSize: '9px' }}>Existing</Tag>
                              )}
                              {isRemoved && (
                                <Tag size="small" color="red" style={{ marginLeft: '4px', fontSize: '9px' }}>Removed</Tag>
                              )}
                            </div>
                            {!isRemoved && (
                              <Button
                                size="small"
                                danger
                                type="link"
                                icon={<DeleteOutlined />}
                                onClick={() => handleRemoveDrillingTool(record.drillingTool.id)}
                                style={{ fontSize: '11px', padding: '0 4px' }}
                              />
                            )}
                          </div>
                          {!isRemoved && (
                            <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>
                              RPM: {truncateToFixed(record.drillingTool.currentRPM || 0, 2)} | 
                              Meter: {truncateToFixed(record.drillingTool.currentMeter || 0, 2)}
                            </div>
                          )}
                        </div>
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
              <Button onClick={handleCancel} size="small" style={{ height: '28px', fontSize: '11px' }}>
                Cancel
              </Button>
              <Button 
                type="primary" 
                onClick={handleSubmit} 
                loading={submitting} 
                size="small"
                style={{ height: '28px', fontSize: '11px' }}
              >
              Save Daily Entries
            </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Daily Entries Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={entries}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            onChange: (page, pageSize) => {
              setPagination(prev => ({ ...prev, current: page, pageSize }));
            },
          }}
          size="middle"
        />
      </Card>

      {/* Service Name Modal */}
      <Modal
        title="Enter Service Name"
        open={showServiceNameModal}
        onOk={handleServiceNameConfirm}
        onCancel={() => {
          setShowServiceNameModal(false);
          setServiceNameInput("");
          setPendingSpareType(null);
        }}
        okText="Continue"
        cancelText="Cancel"
      >
        <Input
          placeholder="Enter service name (e.g., Regular Service, Major Service)"
          value={serviceNameInput}
          onChange={(e) => setServiceNameInput(e.target.value)}
          onPressEnter={handleServiceNameConfirm}
        />
      </Modal>
    </div>
  );
};

export default DailyEntry;

