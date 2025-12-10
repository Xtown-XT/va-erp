import React, { useState, useEffect } from "react";
import {
    Table,
    Button,
    Modal,
    Tag,
    message,
    Card,
    Space,
    Popconfirm
} from "antd";
import {
    PlusOutlined,
    FilePdfOutlined,
    DeleteOutlined
} from "@ant-design/icons";
import api from "../service/api";
import dayjs from "dayjs";
import CreatePurchaseOrder from "./CreatePurchaseOrder";
import ReceivePurchaseOrder from "./ReceivePurchaseOrder";
import { truncateToFixed } from "../utils/textUtils"; // Ensure this util exists or define inline

// Helper for currency format
const formatCurrency = (val) => `₹${Number(val).toFixed(2)}`;

const PurchaseOrderManagement = () => {
    const [pos, setPos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [selectedPO, setSelectedPO] = useState(null);
    const [isReceiveModalVisible, setIsReceiveModalVisible] = useState(false);

    const fetchPOs = async () => {
        setLoading(true);
        try {
            const response = await api.get('/api/purchase-orders');
            if (response.data.success) {
                setPos(response.data.data);
            }
        } catch (error) {
            message.error("Failed to fetch POs");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPOs();
    }, []);

    const handleReceiveClick = (po) => {
        setSelectedPO(po);
        setIsReceiveModalVisible(true);
    };

    const handleDelete = async (id) => {
        try {
            await api.delete(`/api/purchase-orders/${id}`);
            message.success("PO Deleted");
            fetchPOs();
        } catch (error) {
            message.error("Failed to delete PO");
        }
    };

    // Generate PO PDF - Exact Format Implementation
    const generatePOPDF = (po) => {
        const printWindow = window.open("", "_blank");

        // Get supplier and address details
        const supplier = po.supplier;
        const address = po.address;

        // Calculate totals using unified function logic (Replicated here for print)
        // Note: The backend PO object might have stored totalAmount.
        // But for display breakdown, we iterate items.

        let subTotal = 0;
        let taxTotal = 0;
        let grandTotal = 0;

        const itemsWithCalculations = (po.items || []).map((poItem, index) => {
            const unitPrice = Number(poItem.unitPrice || poItem.rate || 0);
            const quantity = Number(poItem.quantity || 0);
            const totalAmount = quantity * unitPrice;

            let itemGST = 0;
            let itemBase = 0;

            if (po.gstInclude && po.gstPercent > 0) {
                // GST-inclusive calculation (matches backend)
                itemGST = (totalAmount * po.gstPercent) / (100 + Number(po.gstPercent));
                itemBase = totalAmount - itemGST;
            } else {
                // No GST
                itemBase = totalAmount;
                itemGST = 0;
            }

            subTotal += itemBase;
            taxTotal += itemGST;
            grandTotal += totalAmount;

            return {
                ...poItem,
                unitPrice,
                amount: itemBase, // Base amount (without GST)
                gstAmount: itemGST,
                totalAmount: totalAmount, // Total amount
                itemName: poItem.spare?.itemName || poItem.drillingTool?.itemName || 'Unknown',
                partNumber: poItem.spare?.partNumber || poItem.drillingTool?.serialNumber || '',
                serialNumber: index + 1
            };
        });

        // Override with PO stored total if needed, but calculation is safer for display consistency
        // const grandTotal = po.totalAmount;

        printWindow.document.write(`
      <html>
        <head>
          <title>Purchase Order - ${po.poNumber}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 0; 
              padding: 10px; 
              font-size: 10px;
              line-height: 1.2;
            }
            .document-border {
              border: 2px solid #000;
              padding: 10px;
              // min-height: 100vh;
              height: auto;
            }
            .company-name { 
              font-size: 20px; 
              font-weight: bold; 
              text-align: center;
              margin-bottom: 3px;
            }
            .contact-row {
              display: flex;
              justify-content: space-between;
              border-bottom: 1px solid #000;
              padding-bottom: 5px;
              margin-bottom: 10px;
            }
            .po-title {
              text-align: center;
              font-size: 14px;
              font-weight: bold;
              margin: 10px 0;
            }
            .date-po-section {
              text-align: right;
              margin-bottom: 10px;
            }
            .to-section {
              margin: 10px 0;
            }
            .to-section h4 {
              margin: 3px 0;
              font-size: 12px;
            }
            .addresses-section {
              display: flex;
              justify-content: space-between;
              margin: 10px 0;
            }
            .address-box {
              width: 48%;
            }
            .address-box h4 {
              margin: 3px 0;
              font-size: 12px;
              text-decoration: underline;
            }
            .subject-section {
              margin: 10px 0;
            }
            .subject-section h4 {
              margin: 3px 0;
              font-size: 12px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 10px 0;
              font-size: 9px;
            }
            table th, table td {
              border: 1px solid #000;
              padding: 4px;
              text-align: left;
            }
            table th {
              background-color: #f0f0f0;
              font-weight: bold;
              text-align: center;
            }
            .text-right {
              text-align: right;
            }
            .text-center {
              text-align: center;
            }
            .total-section {
              margin-top: 10px;
              text-align: right;
            }
            .total-section table {
              width: 250px;
              margin-left: auto;
            }
            .footer-section {
              margin-top: 20px;
              text-align: right;
            }
            .signature-line {
              margin-top: 30px;
              border-top: 1px solid #000;
              width: 150px;
              display: inline-block;
            }
            .kind-attention {
              margin: 5px 0;
            }
            .kind-attention h4 {
              margin: 3px 0;
              font-size: 12px;
            }
            @media print {
              body { margin: 0; padding: 8px; }
              .document-border { padding: 8px; }
            }
          </style>
        </head>
        <body>
          <div class="document-border">
            <!-- Company Header -->
            <div class="company-name">VENKATESWARA ASSOCIATES</div>
            <div class="contact-row">
              <span>Email: ${address?.email || 'N/A'}</span>
              <span>Phone: ${address?.phone || 'N/A'}</span>
            </div>

            <!-- Title -->
            <div class="po-title">PURCHASE ORDER</div>

            <!-- Date and PO Number -->
            <div class="date-po-section">
              <strong>DATE: ${new Date(po.date).toLocaleDateString('en-GB')}</strong><br>
              <strong>PO NO: ${po.poNumber}</strong>
            </div>

            <!-- To Section -->
            <div class="to-section">
              <h4>To:</h4>
              <div><strong>${supplier?.supplierName || 'N/A'}</strong></div>
              <div>${supplier?.address || 'N/A'}</div>
              
              <div class="kind-attention">
                <h4>KIND ATTENTION: ${supplier?.supplierName || 'N/A'}</h4>
                <div><strong>PH No: ${supplier?.phone || 'N/A'}</strong></div>
              </div>
            </div>

            <!-- Addresses Section -->
            <div class="addresses-section">
              <div class="address-box">
                <h4>BILLING ADDRESS</h4>
                <div>${address?.addressBill || 'N/A'}</div>
                <div>GST IN: ${supplier?.gstNumber || 'N/A'}</div>
              </div>
              <div class="address-box">
                <h4>SHIPPING ADDRESS [DOOR DELIVERY]</h4>
                <div>${po.shippingAddress?.addressShip || address?.addressShip || 'N/A'}</div>
                <div>Contact: ${po.shippingAddress?.phone || address?.phone || 'N/A'}</div>
              </div>
            </div>

            <!-- Subject Section -->
            <div class="subject-section">
              <h4>Sub: Purchase Order of Parts</h4>
              <h4>Dear Sir/mam</h4>
              <div>Kindly Arrange the parts as per PO as soon as earliest.</div>
            </div>

            <!-- Items Table -->
            <table>
              <thead>
                <tr>
                  <th>SN</th>
                  <th>PRODUCT DESCRIPTION</th>
                  <th>QTY</th>
                  <th>UNIT PRICE</th>
                  <th>AMOUNT</th>
                  ${po.gstInclude ? `<th>GST ${po.gstPercent || 0}%</th>` : ''}
                  <th>TOTAL AMT</th>
                </tr>
              </thead>
              <tbody>
                ${itemsWithCalculations.map(item => `
                  <tr>
                    <td class="text-center">${item.serialNumber}</td>
                    <td>${item.itemName}</td>
                    <td class="text-center">${item.quantity}</td>
                    <td class="text-right">₹${Number(item.unitPrice).toFixed(2)}</td>
                    <td class="text-right">₹${Number(item.amount).toFixed(2)}</td>
                    ${po.gstInclude ? `<td class="text-right">₹${Number(item.gstAmount).toFixed(2)}</td>` : ''}
                    <td class="text-right">₹${Number(item.totalAmount).toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <!-- Total Section -->
            <div class="total-section">
              <table>
                <tr>
                  <td><strong>TOTAL: ₹${Number(grandTotal).toFixed(2)}</strong></td>
                </tr>
              </table>
            </div>

            <!-- Footer -->
            <div class="footer-section">
              <div><strong>FOR VENKATESWARA ASSOCIATES</strong></div>
              <div class="signature-line"></div>
              <div><strong>AUTHORIZED SIGNATURE</strong></div>
            </div>
          </div>
        </body>
      </html>
    `);
        printWindow.document.close();
        printWindow.print();
    };

    const columns = [
        { title: "PO Number", dataIndex: "poNumber", key: "poNumber" },
        { title: "Date", dataIndex: "date", render: d => dayjs(d).format("DD/MM/YYYY") },
        { title: "Supplier", render: (_, r) => r.supplier?.supplierName || "-" },
        { title: "Amount", dataIndex: "totalAmount", render: a => `₹${a}` },
        {
            title: "Status", dataIndex: "status", render: s => (
                <Tag color={s === 'Received' ? 'green' : 'orange'}>{s.toUpperCase()}</Tag>
            )
        },
        {
            title: "Received By",
            render: (_, r) => r.status === 'Received' ? (
                <div>
                    <div>{r.receivedBy}</div>
                    <small>{dayjs(r.receivedAt).format("DD/MM/YYYY")}</small>
                </div>
            ) : '-'
        },
        {
            title: "Actions",
            key: "actions",
            render: (_, record) => (
                <Space>
                    <Button
                        icon={<FilePdfOutlined />}
                        onClick={() => generatePOPDF(record)}
                        size="small"
                        title="Export PDF"
                    >
                        PDF
                    </Button>

                    {record.status !== 'Received' && (
                        <>
                            <Button
                                type="primary"
                                size="small"
                                onClick={() => handleReceiveClick(record)}
                            >
                                Receive
                            </Button>
                            <Popconfirm title="Delete this PO?" onConfirm={() => handleDelete(record.id)}>
                                <Button danger icon={<DeleteOutlined />} size="small" />
                            </Popconfirm>
                        </>
                    )}
                </Space>
            )
        }
    ];

    return (
        <div className="p-4">
            <Card title="Purchase Orders" extra={
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsCreateModalVisible(true)}>
                    Create PO
                </Button>
            }>
                <Table
                    columns={columns}
                    dataSource={pos}
                    rowKey="id"
                    loading={loading}
                />
            </Card>

            {isCreateModalVisible && (
                <CreatePurchaseOrder
                    visible={isCreateModalVisible}
                    onCancel={() => setIsCreateModalVisible(false)}
                    onSuccess={() => {
                        setIsCreateModalVisible(false);
                        fetchPOs();
                    }}
                />
            )}

            {isReceiveModalVisible && selectedPO && (
                <ReceivePurchaseOrder
                    visible={isReceiveModalVisible}
                    po={selectedPO}
                    onCancel={() => setIsReceiveModalVisible(false)}
                    onSuccess={() => {
                        setIsReceiveModalVisible(false);
                        fetchPOs();
                    }}
                />
            )}
        </div>
    );
};

export default PurchaseOrderManagement;
