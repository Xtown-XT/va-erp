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

const { Title, Text } = Typography;
const { Panel } = Collapse;

const DailyEntry = () => {
  const [form] = Form.useForm();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [sites, setSites] = useState([]);
  const [machines, setMachines] = useState([]);
  const [compressors, setCompressors] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    pageSizeOptions: ['10', '20', '50'],
  });
  
  // Shift 1 state
  const [shift1Data, setShift1Data] = useState({
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
  
  // Shift 2 state  
  const [shift2Data, setShift2Data] = useState({
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
  
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [shift1Enabled, setShift1Enabled] = useState(true);
  const [shift2Enabled, setShift2Enabled] = useState(true);
  const [selectedShift1Machine, setSelectedShift1Machine] = useState(null);
  const [selectedShift2Machine, setSelectedShift2Machine] = useState(null);
  const [selectedShift1Compressor, setSelectedShift1Compressor] = useState(null);
  const [selectedShift2Compressor, setSelectedShift2Compressor] = useState(null);
  const [availableItems, setAvailableItems] = useState([]);
  const [showFitItemModal, setShowFitItemModal] = useState(false);
  const [currentShiftForModal, setCurrentShiftForModal] = useState(null);
  const [selectedItemInstances, setSelectedItemInstances] = useState([]);
  
  const hasFetchedRef = useRef(false);

  // Fetch data
  const fetchEntries = async (page = 1, limit = 10) => {
    setLoading(true);
    try {
      const res = await api.get(`/api/dailyEntries?page=${page}&limit=${limit}`);
      setEntries(res.data.data || []);
      setPagination(prev => ({
        ...prev,
        current: res.data.page || page,
        total: res.data.total || 0,
        pageSize: res.data.limit || limit,
      }));
    } catch (err) {
      message.error(`Failed to fetch daily entries: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchSites = async () => {
    try {
      const res = await api.get("/api/sites?limit=1000");
      setSites(res.data.data || []);
    } catch (err) {
      message.error("Error fetching sites");
    }
  };

  const fetchMachines = async () => {
    try {
      const res = await api.get("/api/vehicles?limit=1000");
      setMachines(res.data.data || []);
    } catch (err) {
      message.error("Error fetching machines");
    }
  };

  const fetchCompressors = async () => {
    try {
      const res = await api.get("/api/compressors?limit=1000");
      setCompressors(res.data.data || []);
    } catch (err) {
      message.error("Error fetching compressors");
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await api.get("/api/employeeLists?limit=10000");
      setEmployees(res.data.data || []);
    } catch (err) {
      message.error("Error fetching employees");
    }
  };

  const fetchAvailableItems = async () => {
    try {
      const res = await api.get("/api/itemInstances/search?status=in_stock&limit=1000");
      setAvailableItems(res.data.data || []);
    } catch (err) {
      message.error("Error fetching available items");
    }
  };

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    
    fetchEntries();
    fetchSites();
    fetchMachines();
    fetchCompressors();
    fetchEmployees();
    fetchAvailableItems();
  }, []);

  // Auto-generate reference number
  const generateRefNo = async () => {
    try {
      const res = await api.get("/api/dailyEntries/generate-ref");
      return res.data.refNo;
    } catch (err) {
      message.error("Error generating ref number");
      return `VA-${Date.now()}`;
    }
  };

  // Handle machine selection for shifts
  const handleMachineChange = (machineId, shift) => {
    const machine = machines.find(m => m.id === machineId);
    
    if (shift === 1) {
      setSelectedShift1Machine(machine);
      setShift1Data(prev => ({
        ...prev,
        vehicleId: machineId,
        vehicleOpeningRPM: machine?.vehicleRPM || 0,
        compressorId: machine?.compressorId || null,
      }));
      
      if (machine?.compressorId) {
        const compressor = compressors.find(c => c.id === machine.compressorId);
        setSelectedShift1Compressor(compressor);
        setShift1Data(prev => ({
          ...prev,
          compressorOpeningRPM: compressor?.compressorRPM || 0,
        }));
      }
    } else {
      setSelectedShift2Machine(machine);
      setShift2Data(prev => ({
        ...prev,
        vehicleId: machineId,
        vehicleOpeningRPM: machine?.vehicleRPM || 0,
        compressorId: machine?.compressorId || null,
      }));
      
      if (machine?.compressorId) {
        const compressor = compressors.find(c => c.id === machine.compressorId);
        setSelectedShift2Compressor(compressor);
        setShift2Data(prev => ({
          ...prev,
          compressorOpeningRPM: compressor?.compressorRPM || 0,
        }));
      }
    }
  };

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
    try {
      const dateStr = selectedDate.format("YYYY-MM-DD");
      
      // If editing, update existing entry
      if (editingId) {
        // Determine which shift is being edited
        const editingEntry = entries.find(e => e.id === editingId);
        const editingShift = editingEntry?.shift || 1;
        
        // Validate the shift being edited
        if (editingShift === 1 && shift1Enabled) {
          const shift1Operators = shift1Data.employees.filter(e => e.role === 'operator' && e.employeeId);
          if (shift1Operators.length === 0) {
            message.error("Shift 1 must have at least one operator");
            return;
          }
          if (!shift1Data.siteId || !shift1Data.vehicleId) {
            message.error("Shift 1 must have site and machine selected");
            return;
          }
        } else if (editingShift === 2 && shift2Enabled) {
          const shift2Operators = shift2Data.employees.filter(e => e.role === 'operator' && e.employeeId);
          if (shift2Operators.length === 0) {
            message.error("Shift 2 must have at least one operator");
            return;
          }
          if (!shift2Data.siteId || !shift2Data.vehicleId) {
            message.error("Shift 2 must have site and machine selected");
            return;
          }
        }

        // Prepare payload based on which shift is being edited
        const shiftData = editingShift === 1 ? shift1Data : shift2Data;
        const payload = {
          date: dateStr,
          shift: editingShift,
          siteId: shiftData.siteId,
          vehicleId: shiftData.vehicleId,
          compressorId: shiftData.compressorId,
          vehicleOpeningRPM: shiftData.vehicleOpeningRPM || 0,
          vehicleClosingRPM: shiftData.vehicleClosingRPM || 0,
          compressorOpeningRPM: shiftData.compressorOpeningRPM || 0,
          compressorClosingRPM: shiftData.compressorClosingRPM || 0,
          dieselUsed: shiftData.dieselUsed || 0,
          vehicleHSD: shiftData.vehicleHSD || 0,
          compressorHSD: shiftData.compressorHSD || 0,
          noOfHoles: shiftData.noOfHoles || 0,
          meter: shiftData.meter || 0,
          employees: shiftData.employees
            .filter(e => e.employeeId)
            .map(e => ({ employeeId: e.employeeId, role: e.role, shift: editingShift })),
          vehicleServiceDone: Boolean(shiftData.vehicleServiceDone),
          compressorServiceDone: Boolean(shiftData.compressorServiceDone),
          fittedItemInstanceIds: shiftData.fittedItems.map(item => item.id),
          removedItemInstanceIds: [],
          notes: editingEntry?.notes || "",
        };

        // Update using PUT API
        await api.put(`/api/dailyEntries/${editingId}`, payload);
        message.success(`Shift ${editingShift} entry updated successfully`);
        
        // Refresh and close form
        await fetchEntries();
        await fetchMachines();
        await fetchCompressors();
        handleCancel();
        return;
      }

      // Create new entries (original logic)
      // Validate Shift 1 (at least one operator required)
      if (shift1Enabled) {
        const shift1Operators = shift1Data.employees.filter(e => e.role === 'operator' && e.employeeId);
        if (shift1Operators.length === 0) {
          message.error("Shift 1 must have at least one operator");
          return;
        }
        if (!shift1Data.siteId || !shift1Data.vehicleId) {
          message.error("Shift 1 must have site and machine selected");
          return;
        }
      }
      
      // Validate Shift 2 if enabled
      if (shift2Enabled) {
        const shift2Operators = shift2Data.employees.filter(e => e.role === 'operator' && e.employeeId);
        if (shift2Operators.length === 0) {
          message.error("Shift 2 must have at least one operator");
          return;
        }
        if (!shift2Data.siteId || !shift2Data.vehicleId) {
          message.error("Shift 2 must have site and machine selected");
          return;
        }
      }

      // Save Shift 1
      if (shift1Enabled) {
        const refNo1 = await generateRefNo();
        const payload1 = {
          refNo: refNo1,
          date: dateStr,
          shift: 1,
          siteId: shift1Data.siteId,
          vehicleId: shift1Data.vehicleId,
          compressorId: shift1Data.compressorId,
          vehicleOpeningRPM: shift1Data.vehicleOpeningRPM || 0,
          vehicleClosingRPM: shift1Data.vehicleClosingRPM || 0,
          compressorOpeningRPM: shift1Data.compressorOpeningRPM || 0,
          compressorClosingRPM: shift1Data.compressorClosingRPM || 0,
          dieselUsed: shift1Data.dieselUsed || 0,
          vehicleHSD: shift1Data.vehicleHSD || 0,
          compressorHSD: shift1Data.compressorHSD || 0,
          noOfHoles: shift1Data.noOfHoles || 0,
          meter: shift1Data.meter || 0,
          employees: shift1Data.employees
            .filter(e => e.employeeId)
            .map(e => ({ employeeId: e.employeeId, role: e.role, shift: 1 })),
          vehicleServiceDone: Boolean(shift1Data.vehicleServiceDone),
          compressorServiceDone: Boolean(shift1Data.compressorServiceDone),
          fittedItemInstanceIds: shift1Data.fittedItems.map(item => item.id),
          removedItemInstanceIds: [],
          notes: "",
        };
        
        await api.post("/api/dailyEntries", payload1);
        message.success("Shift 1 entry saved successfully");
      }

      // Save Shift 2
      if (shift2Enabled) {
        const refNo2 = await generateRefNo();
        const payload2 = {
          refNo: refNo2,
          date: dateStr,
          shift: 2,
          siteId: shift2Data.siteId,
          vehicleId: shift2Data.vehicleId,
          compressorId: shift2Data.compressorId,
          vehicleOpeningRPM: shift2Data.vehicleOpeningRPM || 0,
          vehicleClosingRPM: shift2Data.vehicleClosingRPM || 0,
          compressorOpeningRPM: shift2Data.compressorOpeningRPM || 0,
          compressorClosingRPM: shift2Data.compressorClosingRPM || 0,
          dieselUsed: shift2Data.dieselUsed || 0,
          vehicleHSD: shift2Data.vehicleHSD || 0,
          compressorHSD: shift2Data.compressorHSD || 0,
          noOfHoles: shift2Data.noOfHoles || 0,
          meter: shift2Data.meter || 0,
          employees: shift2Data.employees
            .filter(e => e.employeeId)
            .map(e => ({ employeeId: e.employeeId, role: e.role, shift: 2 })),
          vehicleServiceDone: Boolean(shift2Data.vehicleServiceDone),
          compressorServiceDone: Boolean(shift2Data.compressorServiceDone),
          fittedItemInstanceIds: shift2Data.fittedItems.map(item => item.id),
          removedItemInstanceIds: [],
          notes: "",
        };
        
        await api.post("/api/dailyEntries", payload2);
        message.success("Shift 2 entry saved successfully");
      }

      // Refresh and close form
      message.success("Daily entries saved successfully");
      await fetchEntries();
      await fetchMachines();
      await fetchCompressors();
      handleCancel();
      
    } catch (err) {
      message.error(`Failed to save daily entries: ${err.response?.data?.message || err.message}`);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setShift1Enabled(true);
    setShift2Enabled(true);
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
    try {
      await api.delete(`/api/dailyEntries/${id}`, { data: {} });
      setEntries(entries.filter((entry) => entry.id !== id));
      message.success("Entry deleted successfully");
    } catch (err) {
      message.error("Error deleting daily entry");
    }
  };

  // Handle edit
  const handleEdit = async (id) => {
    try {
      setLoading(true);
      const res = await api.get(`/api/dailyEntries/${id}`);
      const entry = res.data.data;

      if (!entry) {
        message.error("Entry not found");
        return;
      }

      // Set editing ID
      setEditingId(id);

      // Set date
      setSelectedDate(entry.date ? dayjs(entry.date) : dayjs());

      // Determine which shift this entry belongs to
      const entryShift = entry.shift || 1;

      // Prepare employee data
      const entryEmployees = entry.employees || [];
      const employeesData = entryEmployees.map((emp, index) => ({
        id: Date.now() + index,
        employeeId: emp.id,
        role: emp.role || 'operator',
      }));

      // Prepare entry data
      const entryData = {
        siteId: entry.siteId,
        vehicleId: entry.vehicleId,
        compressorId: entry.compressorId,
        vehicleOpeningRPM: entry.vehicleOpeningRPM || 0,
        vehicleClosingRPM: entry.vehicleClosingRPM || 0,
        compressorOpeningRPM: entry.compressorOpeningRPM || 0,
        compressorClosingRPM: entry.compressorClosingRPM || 0,
        vehicleHSD: entry.vehicleHSD || 0,
        compressorHSD: entry.compressorHSD || 0,
        dieselUsed: entry.dieselUsed || 0,
        noOfHoles: entry.noOfHoles || 0,
        meter: entry.meter || 0,
        employees: employeesData,
        fittedItems: [], // Will need to fetch separately if needed
        vehicleServiceDone: entry.vehicleServiceDone || false,
        compressorServiceDone: entry.compressorServiceDone || false,
      };

      // Set machine and compressor selections
      if (entryShift === 1) {
        setShift1Enabled(true);
        setShift1Data(entryData);
        setSelectedShift1Machine(entry.vehicleId);
        setSelectedShift1Compressor(entry.compressorId);
      } else {
        setShift2Enabled(true);
        setShift2Data(entryData);
        setSelectedShift2Machine(entry.vehicleId);
        setSelectedShift2Compressor(entry.compressorId);
      }

      // Show form
      setShowForm(true);
      message.success("Entry loaded for editing");
    } catch (err) {
      message.error(`Failed to load entry: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
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
        extra={shift === 2 && <Switch checked={shift2Enabled} onChange={setShift2Enabled} />}
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
                        />
                      </Col>
                      <Col span={12}>
                        <Text strong>Closing</Text>
                        <InputNumber
                          className="w-full mt-1"
                          value={shiftData.vehicleClosingRPM}
                          onChange={(value) => updateShiftData('vehicleClosingRPM', value)}
                          min={0}
                          step={0.1}
                          precision={1}
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
                          disabled={!shiftData.compressorId}
                        />
                      </Col>
                      <Col span={12}>
                        <Text strong>Closing</Text>
                        <InputNumber
                          className="w-full mt-1"
                          value={shiftData.compressorClosingRPM}
                          onChange={(value) => updateShiftData('compressorClosingRPM', value)}
                          min={0}
                          step={0.1}
                          precision={1}
                          disabled={!shiftData.compressorId}
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
                  />
                </Col>
                <Col xs={24} sm={6}>
                  <Text strong>No. of Holes</Text>
                  <InputNumber
                    className="w-full mt-1"
                    value={shiftData.noOfHoles}
                    onChange={(value) => updateShiftData('noOfHoles', value)}
                    min={0}
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
                      disabled={!shiftData.compressorId}
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
          {canEdit() && (
            <Button 
              icon={<EditOutlined />} 
              onClick={() => handleEdit(record.id)}
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
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <Title level={2} className="mb-2">Daily Entry Management</Title>
          <Text type="secondary">Track daily operations for both shifts</Text>
        </div>
        <Space>
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
        </Space>
      </div>

      {/* Daily Entry Form */}
      {showForm && (
        <Card title="Add Daily Entry" className="mb-6">
          <div className="mb-4">
            <Text strong>Select Date:</Text>
            <DatePicker
              className="w-full mt-1"
              value={selectedDate}
              onChange={setSelectedDate}
              format="DD/MM/YYYY"
            />
          </div>

          {/* Shift 1 Section */}
          {renderShiftSection(1, shift1Data, selectedShift1Machine, selectedShift1Compressor)}

          {/* Shift 2 Section */}
          {renderShiftSection(2, shift2Data, selectedShift2Machine, selectedShift2Compressor)}

          <Divider />

          <div className="flex justify-end space-x-2">
            <Button onClick={handleCancel}>Cancel</Button>
            <Button type="primary" onClick={handleSubmit}>
              Save Daily Entries
            </Button>
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
              fetchEntries(page, pageSize);
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
              label: item.displayLabel || `${item.item?.itemName} (${item.item?.partNumber}) - ${item.instanceNumber}`,
            }))}
          />
          <Table
            dataSource={availableItems.filter(item => selectedItemInstances.includes(item.id))}
            columns={[
              { title: "Instance Number", dataIndex: "instanceNumber", key: "instanceNumber" },
              { title: "Item Name", dataIndex: ["item", "itemName"], key: "itemName" },
              { title: "Part Number", dataIndex: ["item", "partNumber"], key: "partNumber" },
              { 
                title: "Last Used Count", 
                key: "lastUsedCount",
                render: (_, record) => truncateToFixed(record.lastUsedCount || 0, 2)
              },
              { 
                title: "Balance", 
                key: "balance",
                render: (_, record) => record.balance || 0
              },
              { 
                title: "Current Count", 
                key: "currentCount",
                render: (_, record) => truncateToFixed(record.currentCount || 0, 2)
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

