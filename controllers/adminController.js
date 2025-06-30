import db from "../db/db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

// ✅ Register Admin
export const registerAdmin = async (req, res) => {
  const { firstName, lastName, email, contact, country, currency, password } = req.body;

  try {
    // Check if email already exists
    const existingAdmin = await new Promise((resolve, reject) => {
      db.query("SELECT * FROM admins WHERE email = ?", [email], (err, results) => {
        if (err) reject(err);
        resolve(results);
      });
    });

    if (existingAdmin.length > 0) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert into database
    db.query(
      "INSERT INTO admins (firstName, lastName, email, contact, country, currency, password) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [firstName, lastName, email, contact, country, currency || 'USD', hashedPassword],
      (err, result) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: "Admin registered successfully", adminId: result.insertId });
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Login Admin
export const loginAdmin = (req, res) => {
  const { email, password } = req.body;

  // Add validation for empty fields
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  db.query("SELECT * FROM admins WHERE email = ?", [email], async (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: "Database error" });
    }
    
    if (results.length === 0) {
      console.log('No admin found with email:', email);
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const admin = results[0];
    
    try {
      const isValidPassword = await bcrypt.compare(password, admin.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      if (!process.env.SECRET_KEY) {
        console.error('JWT Secret Key is missing');
        return res.status(500).json({ message: "Server configuration error" });
      }

      const token = jwt.sign({ id: admin.id }, process.env.SECRET_KEY, { expiresIn: "24h" });
      
      res.json({
        message: "Login successful",
        token,
        admin: {
          id: admin.id,
          firstName: admin.firstName,
          lastName: admin.lastName,
          email: admin.email,
          contact: admin.contact,
          country: admin.country,
          currency: admin.currency,
          country_code: admin.country_code
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: "Server error during login" });
    }
  });
};
// ✅ Get Admin Details by ID
export const getAdminById = (req, res) => {
  const adminId = req.params.id;

  db.query(
    "SELECT id, firstName, lastName, email, contact, country, currency FROM admins WHERE id = ?",
    [adminId],
    (err, result) => {
      if (err) return res.status(500).json({ message: "Database error" });
      if (result.length === 0) return res.status(404).json({ message: "Admin not found" });

      res.json(result[0]);
    }
  );
};

// ✅ Update Admin Details
export const updateAdmin = async (req, res) => {
  const adminId = req.params.id;
  const { firstName, lastName, email, contact, country } = req.body;

  try {
    const emailCheck = await new Promise((resolve, reject) => {
      db.query(
        "SELECT * FROM admins WHERE email = ? AND id != ?",
        [email, adminId],
        (err, results) => {
          if (err) reject(err);
          resolve(results);
        }
      );
    });

    if (emailCheck.length > 0) {
      return res.status(400).json({ message: "Email already in use" });
    }

    db.query(
      "UPDATE admins SET firstName = ?, lastName = ?, email = ?, contact = ?, country = ? WHERE id = ?",
      [firstName, lastName, email, contact, country, adminId],
      (err, result) => {
        if (err) return res.status(500).json({ message: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ message: "Admin not found" });

        res.json({ message: "Profile updated successfully" });
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Change Admin Password
export const changeAdminPassword = async (req, res) => {
  const adminId = req.params.id;
  const { currentPassword, newPassword } = req.body;

  try {
    // Get current admin data
    const admin = await new Promise((resolve, reject) => {
      db.query("SELECT * FROM admins WHERE id = ?", [adminId], (err, results) => {
        if (err) reject(err);
        resolve(results[0]);
      });
    });

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, admin.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    db.query(
      "UPDATE admins SET password = ? WHERE id = ?",
      [hashedNewPassword, adminId],
      (err, result) => {
        if (err) return res.status(500).json({ message: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ message: "Admin not found" });

        res.json({ message: "Password updated successfully" });
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Get Admin Settings
export const getAdminSettings = async (req, res) => {
  try {
    const adminId = req.params.id;
    db.query(
      "SELECT currency, country, country_code FROM admins WHERE id = ?",
      [adminId],
      (err, results) => {
        if (err) return res.status(500).json({ message: "Database error" });
        if (results.length === 0) return res.status(404).json({ message: "Admin not found" });
        res.json(results[0]);
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export const updateAdminSettings = async (req, res) => {
  const adminId = req.params.id;
  const { currency, country, country_code } = req.body;

  try {
    const currentSettings = await new Promise((resolve, reject) => {
      db.query(
        "SELECT currency, country, country_code FROM admins WHERE id = ?",
        [adminId],
        (err, results) => {
          if (err) reject(err);
          resolve(results[0]);
        }
      );
    });

    if (!currentSettings) {
      return res.status(404).json({ message: "Admin not found" });
    }

    const updateValues = {
      currency: currency || currentSettings.currency,
      country: country || currentSettings.country,
      country_code: country_code || currentSettings.country_code
    };

    db.query(
      "UPDATE admins SET currency = ?, country = ?, country_code = ? WHERE id = ?",
      [updateValues.currency, updateValues.country, updateValues.country_code, adminId],
      (err, result) => {
        if (err) return res.status(500).json({ message: "Database error" });
        if (result.affectedRows === 0) return res.status(404).json({ message: "Admin not found" });

        res.json({
          success: true,
          message: "Settings updated",
          ...updateValues
        });
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
