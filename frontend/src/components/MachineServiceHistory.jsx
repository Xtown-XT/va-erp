import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Table,
  Card,
  Tag,
  Typography,
  Button,
  Space,
  Statistic,
  Row,
  Col,
} from "antd";
import {
  ArrowLeftOutlined,
  ToolOutlined,
  CalendarOutlined,
  FilePdfOutlined,
} from "@ant-design/icons";
import api from "../service/api";
import { truncateToFixed } from "../utils/textUtils";
import dayjs from "dayjs";

const { Title, Text } = Typography;

const MachineServiceHistory = () => {
  const { vehicleId } = useParams(); // Route param kept for compatibility
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [machine, setMachine] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMachineServiceHistory();
  }, [vehicleId]);

  const fetchMachineServiceHistory = async () => {
    setLoading(true);
    try {
      // Fetch machine details
      const machineRes = await api.get(`/api/vehicles/${vehicleId}`); // API route kept
      setMachine(machineRes.data.data);

      // Fetch service history
      const servicesRes = await api.get(`/api/services?machineId=${vehicleId}&serviceType=machine`); // Changed to machineId and machine
      setServices(servicesRes.data.data || []);
    } catch (err) {
      console.error("Error fetching machine service history", err);
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = () => {
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>Machine Service History - ${machine?.vehicleNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .header { text-align: center; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Service History - ${machine?.vehicleNumber}</h1>
            <p>Machine Type: ${machine?.vehicleType}</p>
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Service Date</th>
                <th>Service Name</th>
                <th>Service RPM</th>
                <th>Serviced Item</th>
              </tr>
            </thead>
            <tbody>
              ${services.map(service => `
                <tr>
                  <td>${service.serviceDate ? dayjs(service.serviceDate).format("YYYY-MM-DD") : "-"}</td>
                  <td>${service.serviceName || "N/A"}</td>
                  <td>${service.serviceRPM ? truncateToFixed(service.serviceRPM, 2) : "-"}</td>
                  <td>${service.serviceType === "machine" && service.machine ? 
                    `${service.machine.vehicleNumber} (${service.machine.vehicleType})` : // Changed alias 
                    service.serviceType === "compressor" && service.compressor ? 
                    `${service.compressor.compressorName}` : 
                    "-"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const columns = [
    {
      title: "Service Date",
      dataIndex: "serviceDate",
      key: "serviceDate",
      render: (date) => date ? dayjs(date).format("YYYY-MM-DD") : "-",
    },
    {
      title: "Service Name",
      dataIndex: "serviceName",
      key: "serviceName",
      render: (name) => <Text>{name || "N/A"}</Text>,
    },
    {
      title: "Service RPM",
      dataIndex: "serviceRPM",
      key: "serviceRPM",
      render: (rpm) => <Text strong>{rpm ? truncateToFixed(rpm, 2) : '-'}</Text>,
    },
    {
      title: "Serviced Item",
      key: "servicedItem",
      render: (_, record) => {
        if (record.serviceType === "machine" && record.machine) {
          return `${record.machine.vehicleNumber} (${record.machine.vehicleType})`; // Changed alias
        } else if (record.serviceType === "compressor" && record.compressor) {
          return `${record.compressor.compressorName}`;
        }
        return "-";
      },
    },
  ];

  const totalServices = services.length;
  const lastService = services[0]; // Assuming sorted by date desc
  const nextServiceRPM = machine?.nextServiceRPM || 0;
  const currentRPM = machine?.vehicleRPM || 0; // DB column kept
  const remainingRPM = nextServiceRPM ? Math.max(0, nextServiceRPM - currentRPM) : 0;

  return (
    <div className="bg-white rounded-lg shadow p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-4">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(-1)}
            type="text"
          />
        </div>
        <Button
          icon={<FilePdfOutlined />}
          onClick={exportToPDF}
          type="primary"
          danger
        >
          Export PDF
        </Button>
      </div>

      {/* Statistics */}
      <Row gutter={[8, 8]} className="mb-2">
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Services"
              value={totalServices}
              prefix={<ToolOutlined />}
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Current RPM"
              value={currentRPM}
              suffix="RPM"
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Next Service Due"
              value={remainingRPM}
              suffix="RPM"
              valueStyle={{ color: remainingRPM <= 100 ? "#f5222d" : "#fa8c16" }}
            />
          </Card>
        </Col>
      </Row>

      {/* Service History Table */}
      <Card title="Service Records">
        <Table
          columns={columns}
          dataSource={services}
          rowKey="id"
          loading={loading}
          pagination={{ 
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50']
          }}
          locale={{ emptyText: "No service records found" }}
        />
      </Card>
    </div>
  );
};

export default MachineServiceHistory;
