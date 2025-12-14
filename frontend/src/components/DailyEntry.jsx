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
} from "antd";
import {
  PlusOutlined,
  SaveOutlined,
  DeleteOutlined,
  EditOutlined
} from "@ant-design/icons";
import api from "../service/api";
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
import DrillingToolsSection from "./DrillingToolsSection";
import DailyServiceSection from "./DailyServiceSection";

const { Title, Text } = Typography;

const DailyEntry = () => {
  const [form] = Form.useForm(); // We will use Form but with Manual State mostly for Table Rows? Or fully Form?
  // User wanted "old is good". Old was manual state. 
  // But ServiceEntryForm requires Form instance.
  // I will wrap everything in Form, but use state for the table inputs to mimic old behavior if needed, 
  // or just use Form.Item inside Table for better validation. 
  // Let's try Form.Item inside Table for "Shift 1" and "Shift 2" arrays.

  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [shift1Enabled, setShift1Enabled] = useState(true);
  const [shift2Enabled, setShift2Enabled] = useState(false);
  const [selectedSite, setSelectedSite] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  // Data Selectors
  const { data: sites = [] } = useSites();
  const { data: machines = [] } = useMachines();
  const { data: compressors = [] } = useCompressors();
  const { data: employees = [] } = useEmployees();

  // Queries & Mutations
  const { data: entriesData, isLoading: loadingList, refetch: refetchEntries } = useDailyEntries({
    page: pagination.current,
    limit: pagination.pageSize,
    date: selectedDate.format("YYYY-MM-DD") // Filter list by date? Old UI did this?
    // If I filter by date, users see what they just entered.
  });
  const createDailyEntry = useCreateDailyEntry();
  const deleteDailyEntry = useDeleteDailyEntry();

  // Selected Machine Context (for Config/RPM)
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [selectedCompressor, setSelectedCompressor] = useState(null);

  // Drilling Tools State (Shared for the day/site/machine context)
  const [drillingTools, setDrillingTools] = useState([]);

  // Ref No
  const [refNo1, setRefNo1] = useState("");
  const [refNo2, setRefNo2] = useState("");

  useEffect(() => {
    // Generate Refs
    const gen = async () => {
      try {
        const r = await api.get("/api/dailyEntries/generate-ref");
        setRefNo1(r.data.refNo);
        // Rough logic for Shift 2 ref
        setRefNo2(r.data.refNo.slice(0, -3) + String(parseInt(r.data.refNo.slice(-3)) + 1).padStart(3, '0'));
      } catch (e) { }
    };
    gen();
  }, []);


  // Form Initial Values
  const initialValues = {
    shift1_employees: [{ role: 'operator' }, { role: 'helper' }],
    shift2_employees: [{ role: 'operator' }, { role: 'helper' }],
    services: []
  };

  // Helper to handle machine change
  const onMachineChange = async (machineId) => {
    const machine = machines.find(m => m.id === machineId);
    if (!machine) return;

    setSelectedMachine(machine);
    form.setFieldsValue({
      shift1_machineOpeningRPM: machine.machineRPM || 0,
    });

    // Compressor
    if (machine.compressorId) {
      let comp = compressors.find(c => c.id === machine.compressorId);
      if (!comp) {
        try {
          const res = await api.get(`/api/compressors/${machine.compressorId}`);
          comp = res.data.data;
        } catch (e) { }
      }
      if (comp) {
        setSelectedCompressor(comp);
        form.setFieldsValue({
          shift1_compressorOpeningRPM: comp.compressorRPM || 0,
          shift1_compressorId: comp.id
        });
        fetchFittedTools(comp.id);
      }
    } else {
      setSelectedCompressor(null);
      setDrillingTools([]);
    }
  };

  const fetchFittedTools = async (compressorId) => {
    try {
      const res = await api.get(`/api/dailyEntries/fitted-drilling-tools?compressorId=${compressorId}`);
      if (res.data.success) {
        setDrillingTools(res.data.data.map(t => ({
          ...t,
          isExisting: true,
          startingRPM: t.currentRPM || 0,
          currentRPM: t.currentRPM || 0,
          currentMeter: t.currentMeter || 0
        })));
      }
    } catch (e) { console.error("Error fetching fittings", e); }
  };

  // Tool Handlers
  const handleAddTool = (item, qty) => {
    setDrillingTools(prev => [...prev, {
      id: Date.now(),
      itemId: item.id,
      itemName: item.itemName,
      partNumber: item.partNumber,
      quantity: qty,
      action: 'fit',
      startingRPM: selectedCompressor?.compressorRPM || 0,
      currentRPM: selectedCompressor?.compressorRPM || 0,
      currentMeter: 0,
      isExisting: false
    }]);
  };

  const handleRemoveTool = (id) => {
    setDrillingTools(prev => prev.map(t => t.id === id ? { ...t, action: 'remove' } : t));
  };

  const handleUpdateTool = (id, field, value) => {
    setDrillingTools(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  // Submit
  const onFinish = async (values) => {
    // Pre-process services
    const processedServices = (values.services || []).map(svc => {
      const [type, id] = (svc.assetKey || "").split(":");
      return {
        entityType: type,
        entityId: id,
        serviceName: Array.isArray(svc.serviceName) ? svc.serviceName[0] : svc.serviceName,
        currentRpm: svc.currentRpm,
        spares: svc.spares
      };
    });

    const dateStr = selectedDate.format("YYYY-MM-DD");

    // Shift 1
    if (shift1Enabled) {
      const payload1 = {
        date: dateStr,
        shift: 1,
        refNo: refNo1,
        siteId: values.siteId,
        machineId: values.machineId,
        compressorId: selectedCompressor?.id,

        machineOpeningRPM: values.shift1_machineOpeningRPM,
        machineClosingRPM: values.shift1_machineClosingRPM,
        compressorOpeningRPM: values.shift1_compressorOpeningRPM,
        compressorClosingRPM: values.shift1_compressorClosingRPM,

        noOfHoles: values.shift1_noOfHoles,
        meter: values.shift1_meter,
        dieselUsed: values.shift1_dieselUsed,
        machineHSD: values.shift1_machineHSD,
        compressorHSD: values.shift1_compressorHSD,

        employees: values.shift1_employees,

        // Attach Services to Shift 1 only? Or split them?
        // Since backend handles array now, we can attach to Shift 1 entry.
        // We should send it only once.
        services: processedServices,

        // Drilling Tools (Logs) attached to Shift 1
        drillingTools: drillingTools.map(t => ({
          toolId: t.itemId,
          action: t.action === 'fit' ? 'INSTALL' : (t.action === 'remove' ? 'REMOVE' : 'UPDATE'),
          quantity: t.quantity,
          currentMachineRPM: t.currentRPM,
          currentMachineMeter: t.currentMeter,
          date: dateStr
        })).filter(t => t.action)
      };
      await createDailyEntry.mutateAsync(payload1);
    }

    // Shift 2
    if (shift2Enabled) {
      const payload2 = {
        date: dateStr,
        shift: 2,
        refNo: refNo2,
        siteId: values.siteId,
        machineId: values.machineId,
        compressorId: selectedCompressor?.id,

        machineOpeningRPM: values.shift2_machineOpeningRPM,
        machineClosingRPM: values.shift2_machineClosingRPM,
        compressorOpeningRPM: values.shift2_compressorOpeningRPM,
        compressorClosingRPM: values.shift2_compressorClosingRPM,

        noOfHoles: values.shift2_noOfHoles,
        meter: values.shift2_meter,
        dieselUsed: values.shift2_dieselUsed,
        machineHSD: values.shift2_machineHSD,
        compressorHSD: values.shift2_compressorHSD,

        employees: values.shift2_employees,

        // Do NOT send services/tools again for Shift 2 to avoid double counting
        // unless there's a specific requirement. 
        // User said "remove shift based service".
        // It's "Daily" service.
      };
      await createDailyEntry.mutateAsync(payload2);
    }

    message.success("Entries Saved");
    form.resetFields();
    // Reset defaults
    form.setFieldsValue({
      shift1_employees: [{ role: 'operator' }, { role: 'helper' }],
      shift2_employees: [{ role: 'operator' }, { role: 'helper' }],
    });
    setDrillingTools([]);
    setShift1Enabled(true);
    setShift2Enabled(false);
    refetchEntries();
  };

  return (
    <div className="p-2">
      <Card title="Daily Entry" size="small">
        <Form form={form} onFinish={onFinish} layout="vertical" initialValues={initialValues}>
          {/* Header: Date, Site, Machine - Unchanged */}
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label="Date" name="date" initialValue={dayjs()}>
                <DatePicker format="DD/MM/YYYY" onChange={setSelectedDate} allowClear={false} className="w-full" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Site" name="siteId" rules={[{ required: true }]}>
                <Select showSearch optionFilterProp="children" onChange={setSelectedSite}>
                  {sites.map(s => <Select.Option key={s.id} value={s.id}>{s.siteName}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Machine" name="machineId" rules={[{ required: true }]}>
                <Select showSearch optionFilterProp="children" onChange={onMachineChange}>
                  {machines.filter(m => !selectedSite || m.siteId === selectedSite).map(m => (
                    <Select.Option key={m.id} value={m.id}>{m.machineNumber}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Compressor">
                <Input value={selectedCompressor?.compressorName || "None"} disabled />
              </Form.Item>
            </Col>
          </Row>

          <Row>
            <Col>
              <Space>
                <Switch checked={shift2Enabled} onChange={setShift2Enabled} /> <Text>Enable Shift 2</Text>
              </Space>
            </Col>
          </Row>

          {/* Table Layout - Unchanged except we pass props if needed */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10, marginBottom: 20 }}>
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="p-2 border">Shift</th>
                <th className="p-2 border">Machine RPM (Open/Close)</th>
                <th className="p-2 border">Comp RPM (Open/Close)</th>
                <th className="p-2 border">Prod (Holes/Meter)</th>
                <th className="p-2 border">Fuel (D/M/C)</th>
                <th className="p-2 border">Crew</th>
              </tr>
            </thead>
            <tbody>
              {/* Shift 1 Row */}
              {/* ... (Existing Shift 1/2 rows, we only removed ServiceSection below) */}
              <tr>
                <td className="p-2 border font-bold">Shift 1</td>
                <td className="p-2 border">
                  <Space direction="vertical" size={0}>
                    <Form.Item name="shift1_machineOpeningRPM" noStyle><InputNumber placeholder="Open" size="small" /></Form.Item>
                    <Form.Item name="shift1_machineClosingRPM" noStyle>
                      <InputNumber
                        placeholder="Close" size="small"
                        onChange={(v) => {
                          if (shift2Enabled) form.setFieldsValue({ shift2_machineOpeningRPM: v });
                        }}
                      />
                    </Form.Item>
                  </Space>
                </td>
                <td className="p-2 border">
                  <Space direction="vertical" size={0}>
                    <Form.Item name="shift1_compressorOpeningRPM" noStyle><InputNumber placeholder="Open" size="small" /></Form.Item>
                    <Form.Item name="shift1_compressorClosingRPM" noStyle>
                      <InputNumber
                        placeholder="Close" size="small"
                        onChange={(v) => {
                          if (shift2Enabled) form.setFieldsValue({ shift2_compressorOpeningRPM: v });
                        }}
                      />
                    </Form.Item>
                  </Space>
                </td>
                <td className="p-2 border">
                  <Space direction="vertical" size={0}>
                    <Form.Item name="shift1_noOfHoles" noStyle><InputNumber placeholder="Holes" size="small" /></Form.Item>
                    <Form.Item name="shift1_meter" noStyle><InputNumber placeholder="Meter" size="small" /></Form.Item>
                  </Space>
                </td>
                <td className="p-2 border">
                  <Space direction="vertical" size={0}>
                    <Form.Item name="shift1_dieselUsed" noStyle><InputNumber placeholder="Diesel" size="small" /></Form.Item>
                    <Form.Item name="shift1_machineHSD" noStyle><InputNumber placeholder="M. HSD" size="small" /></Form.Item>
                    <Form.Item name="shift1_compressorHSD" noStyle><InputNumber placeholder="C. HSD" size="small" /></Form.Item>
                  </Space>
                </td>
                <td className="p-2 border">
                  <Form.List name="shift1_employees">
                    {(fields) => (
                      <div>
                        {fields.map(({ key, name, ...restField }) => (
                          <Space key={key} align="baseline">
                            <Form.Item {...restField} name={[name, 'employeeId']} noStyle>
                              <Select style={{ width: 120 }} size="small" placeholder="Emp">
                                {employees.map(e => <Select.Option key={e.id} value={e.id}>{e.name}</Select.Option>)}
                              </Select>
                            </Form.Item>
                          </Space>
                        ))}
                      </div>
                    )}
                  </Form.List>
                </td>
              </tr>

              {/* Shift 2 Row */}
              {shift2Enabled && (
                <tr>
                  <td className="p-2 border font-bold">Shift 2</td>
                  <td className="p-2 border">
                    <Space direction="vertical" size={0}>
                      <Form.Item name="shift2_machineOpeningRPM" noStyle><InputNumber placeholder="Open" size="small" /></Form.Item>
                      <Form.Item name="shift2_machineClosingRPM" noStyle><InputNumber placeholder="Close" size="small" /></Form.Item>
                    </Space>
                  </td>
                  <td className="p-2 border">
                    <Space direction="vertical" size={0}>
                      <Form.Item name="shift2_compressorOpeningRPM" noStyle><InputNumber placeholder="Open" size="small" /></Form.Item>
                      <Form.Item name="shift2_compressorClosingRPM" noStyle><InputNumber placeholder="Close" size="small" /></Form.Item>
                    </Space>
                  </td>
                  <td className="p-2 border">
                    <Space direction="vertical" size={0}>
                      <Form.Item name="shift2_noOfHoles" noStyle><InputNumber placeholder="Holes" size="small" /></Form.Item>
                      <Form.Item name="shift2_meter" noStyle><InputNumber placeholder="Meter" size="small" /></Form.Item>
                    </Space>
                  </td>
                  <td className="p-2 border">
                    <Space direction="vertical" size={0}>
                      <Form.Item name="shift2_dieselUsed" noStyle><InputNumber placeholder="Diesel" size="small" /></Form.Item>
                      <Form.Item name="shift2_machineHSD" noStyle><InputNumber placeholder="M. HSD" size="small" /></Form.Item>
                      <Form.Item name="shift2_compressorHSD" noStyle><InputNumber placeholder="C. HSD" size="small" /></Form.Item>
                    </Space>
                  </td>
                  <td className="p-2 border">
                    <Form.List name="shift2_employees">
                      {(fields) => (
                        <div>
                          {fields.map(({ key, name, ...restField }) => (
                            <Space key={key} align="baseline">
                              <Form.Item {...restField} name={[name, 'employeeId']} noStyle>
                                <Select style={{ width: 120 }} size="small" placeholder="Emp">
                                  {employees.map(e => <Select.Option key={e.id} value={e.id}>{e.name}</Select.Option>)}
                                </Select>
                              </Form.Item>
                            </Space>
                          ))}
                        </div>
                      )}
                    </Form.List>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* New Service Section */}
          <DailyServiceSection form={form} machines={machines} compressor={selectedCompressor} siteId={selectedSite} />

          {/* Drilling Tools */}
          {selectedCompressor && (
            <div style={{ marginTop: 20 }}>
              <DrillingToolsSection
                drillingTools={drillingTools}
                onAddTool={handleAddTool}
                onRemoveTool={handleRemoveTool}
                onUpdateTool={handleUpdateTool}
                compressorName={selectedCompressor.compressorName}
                siteId={selectedSite}
              />
            </div>
          )}

          <Row justify="end" style={{ marginTop: 20 }}>
            <Button type="primary" htmlType="submit" size="large" icon={<SaveOutlined />}>Save All Entries</Button>
          </Row>
        </Form>
      </Card>

      {/* History List */}
      <Card title="History" style={{ marginTop: 20 }}>
        <Table
          dataSource={entriesData?.data || []}
          columns={[
            { title: "Date", dataIndex: "date", render: d => dayjs(d).format("DD/MM/YYYY") },
            { title: "Ref", dataIndex: "refNo" },
            { title: "Shift", dataIndex: "shift" },
            { title: "Site", dataIndex: ["site", "siteName"] },
            { title: "Machine", dataIndex: ["machine", "machineNumber"] },
            { title: "Action", render: (_, r) => <Popconfirm title="Delete?" onConfirm={() => deleteDailyEntry.mutateAsync(r.id)}><Button danger size="small" icon={<DeleteOutlined />} /></Popconfirm> }
          ]}
          size="small"
          rowKey="id"
          pagination={{ total: entriesData?.total || 0, onChange: (p) => setPagination({ ...pagination, current: p }) }}
        />
      </Card>
    </div>
  );
};

export default DailyEntry;
