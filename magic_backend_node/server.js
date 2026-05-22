const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'restmagicfood',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

(async () => {
    try {
        const conn = await db.getConnection();
        console.log("✅ MySQL Pool Connected Successfully!");
        conn.release();
    } catch (err) {
        console.log("❌ Database Error: " + err.message);
    }
})();

app.post('/register', async (req, res) => {
    const { name, phone, password } = req.body;
    try {
        await db.query("INSERT INTO users (name, phone, password) VALUES (?, ?, ?)", [name, phone, password]);
        res.json({ success: true, message: "User registered successfully!" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Error: " + err.message });
    }
});

app.post('/login', async (req, res) => {
    const { phone, password } = req.body;
    try {
        const [rows] = await db.query("SELECT * FROM users WHERE phone = ? AND password = ?", [phone, password]);
        if (rows.length > 0) {
            res.json({ success: true, user: rows[0], message: "Login Successful" });
        } else {
            res.json({ success: false, message: "Invalid Phone or Password" });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: "Server Error: " + err.message });
    }
});

app.post('/book', async (req, res) => {
    const { name, phone, date, time, guests } = req.body;
    try {
        await db.query("INSERT INTO bookings (name, phone, date, time, guests) VALUES (?, ?, ?, ?, ?)", [name, phone, date, time, guests]);
        res.json({ success: true, message: "Table Reserved Successfully!" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Booking Failed: " + err.message });
    }
});

app.get('/menu', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM menu ORDER BY id DESC");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/menu', async (req, res) => {
    const { name, desc, category, price, image } = req.body;
    try {
        await db.query("INSERT INTO menu (name, description, category, price, image) VALUES (?, ?, ?, ?, ?)", [name, desc, category, price, image]);
        res.json({ success: true, message: "Item added successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/order', async (req, res) => {
    const { phone, items, total, address, method } = req.body;
    try {
        const payment_status = method === 'cod' ? 'Pending' : 'Success';
        const order_status = 'Pending';
        const itemsJson = JSON.stringify(items);
        const [result] = await db.query(
            "INSERT INTO orders (user_phone, items, total_amount, address, payment_method, payment_status, order_status) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [phone, itemsJson, total, address, method, payment_status, order_status]
        );
        console.log("📦 New Order #" + result.insertId + " | Method: " + method);
        res.json({ success: true, order_id: result.insertId });
    } catch (err) {
        console.error("❌ Order Error:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/admin/update-status', async (req, res) => {
    const { orderId, status } = req.body;
    try {
        await db.query("UPDATE orders SET order_status = ? WHERE id = ?", [status, orderId]);
        console.log("🔄 Order #" + orderId + " → " + status);
        res.json({ success: true, message: "Status Updated" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/my-orders', async (req, res) => {
    const { phone } = req.body;
    try {
        const [rows] = await db.query("SELECT * FROM orders WHERE user_phone = ? ORDER BY id DESC", [phone]);
        res.json({ success: true, orders: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/all-orders', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM orders ORDER BY id DESC");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/admin/analytics', async (req, res) => {
    try {
        const [results] = await db.query("SELECT * FROM orders ORDER BY order_date DESC");
        let totalRevenue = 0;
        const salesMap = {};
        const itemMap = {};
        results.forEach(order => {
            totalRevenue += parseFloat(order.total_amount) || 0;
            const date = new Date(order.order_date).toISOString().split('T')[0];
            salesMap[date] = (salesMap[date] || 0) + (parseFloat(order.total_amount) || 0);
            let items = [];
            try { items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items; } catch (e) {}
            items.forEach(item => {
                if (item && item.name) itemMap[item.name] = (itemMap[item.name] || 0) + (item.quantity || 1);
            });
        });
        const salesLabels = Object.keys(salesMap).slice(-7);
        const salesData = salesLabels.map(d => salesMap[d]);
        const sortedItems = Object.entries(itemMap).sort((a, b) => b[1] - a[1]);
        const itemLabels = sortedItems.slice(0, 5).map(i => i[0]);
        const itemData = sortedItems.slice(0, 5).map(i => i[1]);
        res.json({
            stats: { revenue: totalRevenue.toFixed(2), orders: results.length, topItem: itemLabels[0] || "N/A" },
            charts: { sales: { labels: salesLabels, data: salesData }, items: { labels: itemLabels, data: itemData } }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("\n======================================================");
    console.log("✅ Backend Server is running on port " + PORT);
    console.log("🌍 Login Page    : http://localhost/magic_frontend/userlogin.html");
    console.log("🛵 COD Page      : http://localhost/magic_frontend/cod.html");
    console.log("⚙️  Admin Panel   : http://localhost/magic_frontend/admin.html");
    console.log("======================================================\n");
});