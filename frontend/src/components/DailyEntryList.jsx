import React from 'react';
import { Table, Button, Popconfirm, Tag, Space, Typography } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;

const DailyEntryList = ({
    entries,
    loading,
    pagination,
    onChange,
    onEdit,
    onDelete
}) => {

    const columns = [
        {
            title: 'Date',
            dataIndex: 'date',
            key: 'date',
            render: (date) => dayjs(date).format('DD/MM/YYYY'),
            width: 100
        },
        {
            title: 'Ref No',
            dataIndex: 'refNo',
            key: 'refNo',
            width: 120
        },
        {
            title: 'Shift',
            dataIndex: 'shift',
            key: 'shift',
            width: 60,
            render: (shift) => <Tag color={shift === 1 ? 'blue' : 'purple'}>{shift}</Tag>
        },
        {
            title: 'Site',
            dataIndex: ['site', 'siteName'],
            key: 'site',
            width: 150
        },
        {
            title: 'Machine',
            dataIndex: ['machine', 'machineNumber'],
            key: 'machine',
            width: 120,
            render: (text, record) => text || record.machineId
        },
        {
            title: 'Production',
            key: 'production',
            render: (_, record) => (
                <div className="text-xs">
                    <div>Holes: {record.noOfHoles}</div>
                    <div>Meter: {record.meter}</div>
                </div>
            )
        },
        {
            title: 'RPM',
            key: 'rpm',
            render: (_, record) => {
                const machineTotal = (record.machineClosingRPM || 0) - (record.machineOpeningRPM || 0);
                const compTotal = (record.compressorClosingRPM || 0) - (record.compressorOpeningRPM || 0);
                return (
                    <div className="text-xs">
                        <div>M: {machineTotal.toFixed(1)}</div>
                        <div>C: {compTotal.toFixed(1)}</div>
                    </div>
                );
            }
        },
        {
            title: 'Crew',
            key: 'employees',
            ellipsis: true,
            render: (_, record) => (
                <Space direction="vertical" size={0}>
                    {(record.employees || []).map(e => <Text key={e.id} style={{ fontSize: 10 }}>{e.name} ({e.role})</Text>)}
                </Space>
            )
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 100,
            render: (_, record) => (
                <Space>
                    <Button
                        icon={<EditOutlined />}
                        size="small"
                        onClick={() => onEdit(record)}
                    />
                    <Popconfirm title="Delete?" onConfirm={() => onDelete(record.id)}>
                        <Button icon={<DeleteOutlined />} size="small" danger />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <Table
            dataSource={entries}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={pagination}
            onChange={onChange}
            size="small"
        />
    );
};

export default DailyEntryList;
