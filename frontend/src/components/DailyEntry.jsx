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
  useAvailableItems, 
  useDailyEntries
} from "../hooks/useQueries";
import { useCreateDailyEntry, useDeleteDailyEntry } from "../hooks/useMutations";

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
  const { data: availableItems = [] } = useAvailableItems();
  
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
    fittedItems: [],
    vehicleServiceDone: false,
    compressorServiceDone: false,
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
    fittedItems: [],
    vehicleServiceDone: false,
    compressorServiceDone: false,
  });
  
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [shift1Enabled, setShift1Enabled] = useState(true);
  const [shift2Enabled, setShift2Enabled] = useState(true); // Always enabled
  const [selectedShift1Machine, setSelectedShift1Machine] = useState(null);
  const [selectedShift2Machine, setSelectedShift2Machine] = useState(null);
  const [selectedShift1Compressor, setSelectedShift1Compressor] = useState(null);
  const [selectedShift2Compressor, setSelectedShift2Compressor] = useState(null);
  const [showFitItemModal, setShowFitItemModal] = useState(false);
  const [currentShiftForModal, setCurrentShiftForModal] = useState(null);
  const [selectedItemInstances, setSelectedItemInstances] = useState([]);
  const [validationWarnings, setValidationWarnings] = useState([]);

  // Update pagination when entries data changes
  useEffect(() => {
    setPagination(prev => ({
      ...prev,
      current: entriesData.page || prev.current,
      total: entriesData.total || 0,
      pageSize: entriesData.limit || prev.pageSize,
    }));
  }, [entriesData]);

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
      setSelectedShift2Machine(machine);
      // Only auto-fill if Shift 1 closing RPM hasn't been set yet
      const shouldAutoFill = shift1Data.vehicleClosingRPM === null;
      setShift2Data(prev => ({
        ...prev,
        vehicleId: machineId,
        vehicleOpeningRPM: shouldAutoFill ? (machine?.vehicleRPM || null) : prev.vehicleOpeningRPM, // Auto-fill from machine or keep Shift 1 closing
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

  // Open fit item modal
  const openFitItemModal = (shift) => {
    setCurrentShiftForModal(shift);
    setShowFitItemModal(true);
  };

  // Handle fitting items
  const handleFitItems = () => {
    const newFittedItems = availableItems.filter(item =>
      selectedItemInstances.includes(item.id)
    );
    
    if (currentShiftForModal === 1) {
      setShift1Data(prev => ({
        ...prev,
        fittedItems: [...prev.fittedItems, ...newFittedItems],
      }));
    } else {
      setShift2Data(prev => ({
        ...prev,
        fittedItems: [...prev.fittedItems, ...newFittedItems],
      }));
    }
    
    setSelectedItemInstances([]);
    setShowFitItemModal(false);
  };

  // Remove fitted item
  const removeFittedItem = (shift, instanceId) => {
    if (shift === 1) {
      setShift1Data(prev => ({
        ...prev,
        fittedItems: prev.fittedItems.filter(item => item.id !== instanceId),
      }));
    } else {
      setShift2Data(prev => ({
        ...prev,
        fittedItems: prev.fittedItems.filter(item => item.id !== instanceId),
      }));
    }
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
      const shift2Operators = shift2Data.employees.filter(e => e.role === 'operator' && e.employeeId);
      if (shift2Operators.length === 0) {
        warnings.push("Shift 2: No operator selected");
      }
      if (!shift2Data.siteId) {
        warnings.push("Shift 2: Site not selected");
      }
      if (!shift2Data.vehicleId) {
        warnings.push("Shift 2: Machine not selected");
      }
      
      // Display warnings if any
      if (warnings.length > 0) {
        setValidationWarnings(warnings);
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

      // Save Shift 1
      if (shift1Enabled) {
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
          vehicleServiceDone: Boolean(shift1Data.vehicleServiceDone),
          compressorServiceDone: Boolean(shift1Data.compressorServiceDone),
          fittedItemInstanceIds: shift1Data.fittedItems.map(item => item.id),
          removedItemInstanceIds: [],
          notes: "",
        });
        
        await createDailyEntry.mutateAsync(payload1);
      }

      // Save Shift 2 (always enabled)
      const payload2 = cleanPayload({
        refNo: refNo2,
        date: dateStr,
        shift: 2,
        siteId: shift2Data.siteId,
        vehicleId: shift2Data.vehicleId,
        compressorId: shift2Data.compressorId,
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
        vehicleServiceDone: Boolean(shift2Data.vehicleServiceDone),
        compressorServiceDone: Boolean(shift2Data.compressorServiceDone),
        fittedItemInstanceIds: shift2Data.fittedItems.map(item => item.id),
        removedItemInstanceIds: [],
        notes: "",
      });
      
      await createDailyEntry.mutateAsync(payload2);

      // Clear warnings on success (mutations handle success messages)
      setValidationWarnings([]);
      setSubmitting(false);
      refetchEntries();
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
      fittedItems: [],
      vehicleServiceDone: false,
      compressorServiceDone: false,
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
      fittedItems: [],
      vehicleServiceDone: false,
      compressorServiceDone: false,
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
                    {machines.map(machine => (
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
                  <Text strong>Diesel Used</Text>
                  <InputNumber
                    className="w-full mt-1"
                    value={shiftData.dieselUsed}
                    onChange={(value) => updateShiftData('dieselUsed', value)}
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
                          {employee.name} ({employee.empId})
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
            {/* Top Row: Ref No, Date, Site, Machine Type, Machine No, Compressor No */}
            <Row gutter={[4, 4]} style={{ marginBottom: '4px' }}>
              <Col span={4}>
                <Text strong style={{ fontSize: '11px', display: 'block', marginBottom: '2px' }}>Ref No:</Text>
                <Input 
                  size="small" 
                  placeholder="Auto-generated" 
                  disabled 
                  style={{ fontSize: '11px' }}
                />
              </Col>
              <Col span={4}>
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
              <Col span={4}>
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
              <Col span={4}>
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
                <Text strong style={{ fontSize: '11px', display: 'block', marginBottom: '2px' }}>Machine No:</Text>
                <Input 
                  size="small" 
                  value={selectedShift1Machine?.vehicleNumber || ''} 
                  disabled 
                  style={{ fontSize: '11px' }}
                />
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
                  title: 'Diesel Used',
                  key: 'dieselUsed',
                  width: 100,
                  render: (_, record) => (
                    <InputNumber
                      size="small"
                      placeholder="0.0"
                      value={record.data.dieselUsed}
                      onChange={(value) => {
                        if (record.key === 'shift1') {
                          setShift1Data(prev => ({ ...prev, dieselUsed: value }));
                        } else {
                          setShift2Data(prev => ({ ...prev, dieselUsed: value }));
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
                            {employee.name} ({employee.empId})
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
                            {employee.name} ({employee.empId})
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

            {/* Fitted Items */}
            <div style={{ marginBottom: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <Text strong style={{ fontSize: '11px' }}>Fitted Items:</Text>
                <Button
                  size="small"
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => openFitItemModal(1)}
                  style={{ fontSize: '11px', padding: '0 8px', height: '24px' }}
                >
                  Fit Item
                </Button>
              </div>
              <Table
                size="small"
                pagination={false}
                dataSource={shift1Data.fittedItems.map((item, idx) => ({ ...item, key: idx }))}
                columns={[
                  { title: 'S.No', key: 'sno', width: 40, render: (_, __, index) => index + 1 },
                  { 
                    title: 'Item Name', 
                    key: 'itemName', 
                    render: (_, record) => record.itemName || record.modelName 
                  },
                  { 
                    title: 'Model Name', 
                    key: 'modelName',
                    width: 120,
                    dataIndex: 'modelName'
                  },
                  { 
                    title: 'Current RPM', 
                    key: 'currentRPM', 
                    width: 120,
                    render: (_, record) => truncateToFixed(record.currentRPM || record.currentCount || 0, 2)
                  },
                  { 
                    title: 'Next Service RPM', 
                    key: 'nextServiceRPM', 
                    width: 140,
                    render: (_, record) => {
                      return truncateToFixed(record.nextServiceRPM || 0, 2);
                    }
                  },
                  {
                    title: 'Actions',
                    key: 'actions',
                    width: 80,
                    render: (_, record) => (
                      <Button
                        size="small"
                        danger
                        onClick={() => removeFittedItem(1, record.id)}
                        style={{ fontSize: '11px', padding: '0 8px', height: '24px' }}
                      >
                        Remove
                      </Button>
                    )
                  }
                ]}
                style={{ fontSize: '11px' }}
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

      {/* Fit Item Modal */}
      <Modal
        title="Fit New Item"
        open={showFitItemModal}
        onCancel={() => {
          setShowFitItemModal(false);
          setSelectedItemInstances([]);
        }}
        onOk={handleFitItems}
        okText="Fit Items"
        cancelText="Cancel"
        width={800}
      >
        <div>
          <p>Select items to fit (search by name, part number, or instance number):</p>
          <Select
            mode="multiple"
            className="w-full mb-4"
            placeholder="Search and select items..."
            value={selectedItemInstances}
            onChange={setSelectedItemInstances}
            showSearch
            filterOption={(input, option) =>
              option.label.toLowerCase().includes(input.toLowerCase())
            }
            options={availableItems.map(item => ({
              value: item.id,
              label: item.displayLabel || `${item.itemName} (${item.partNumber}) - ${item.modelName}`,
            }))}
          />
          <Table
            dataSource={availableItems.filter(item => selectedItemInstances.includes(item.id))}
            columns={[
              { title: "Model Name", dataIndex: "modelName", key: "modelName", width: 120 },
              { title: "Item Name", dataIndex: "itemName", key: "itemName" },
              { title: "Part Number", dataIndex: "partNumber", key: "partNumber", width: 150 },
              { 
                title: "Current RPM", 
                key: "currentRPM",
                width: 120,
                render: (_, record) => truncateToFixed(record.currentRPM || record.currentCount || 0, 2)
              },
              { 
                title: "Next Service RPM", 
                key: "nextServiceRPM",
                width: 150,
                render: (_, record) => {
                  return truncateToFixed(record.nextServiceRPM || 0, 2);
                }
              },
            ]}
            pagination={false}
            size="small"
            rowKey="id"
          />
        </div>
      </Modal>
    </div>
  );
};

export default DailyEntry;

