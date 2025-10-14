// import bcrypt from "bcryptjs";
// import User from "../modules/user/user.model.js";

// export async function seedAdminUser() {
//   try {
//     const count = await User.count();
//     if (count === 0) {
//       const hashedPassword = await bcrypt.hash(
//         process.env.ADMIN_PASSWORD || "admin123",
//         10
//       );

//       await User.create({
//         username: "xtown",
//         password: hashedPassword,
//         role: "admin",
//         createdBy: "system",
//       });

//     } else {
//     }
//   } catch (err) {
//     console.error("❌ Error seeding admin user:", err);
//   }
// }

// src/shared/seedAdmin.js
import bcrypt from "bcryptjs";
import User from "../modules/user/user.model.js";

export async function seedAdminUser() {
  try {
    console.log("🌱 Checking admin user...");
    
    const count = await User.count();
    console.log(`📊 Total users in database: ${count}`);
    
    if (count === 0) {
      console.log("👤 No users found. Creating admin user...");
      
      const hashedPassword = await bcrypt.hash(
        process.env.ADMIN_PASSWORD || "admin123",
        10
      );

      const adminUser = await User.create({
        username: "xtown",
        password: hashedPassword,
        role: "admin",
        createdBy: "system",
      });

      console.log("✅ Admin user created successfully!");
      console.log("📋 Login credentials:");
      console.log("   Username: xtown");
      console.log("   Password:", process.env.ADMIN_PASSWORD || "admin123");
      console.log("   User ID:", adminUser.id);
    } else {
      console.log("👤 Users already exist. Checking for admin...");
      
      const adminUser = await User.findOne({ 
        where: { username: "xtown" } 
      });
      
      if (adminUser) {
        console.log("✅ Admin user 'xtown' exists");
        console.log("   User ID:", adminUser.id);
        console.log("   Role:", adminUser.role);
        
        // Verify password works
        const testPassword = process.env.ADMIN_PASSWORD || "admin123";
        const isValid = await bcrypt.compare(testPassword, adminUser.password);
        
        if (isValid) {
          console.log("✅ Password is valid");
          console.log("📋 Login with:");
          console.log("   Username: xtown");
          console.log("   Password:", testPassword);
        } else {
          console.log("⚠️  Password mismatch detected. Resetting...");
          const newHash = await bcrypt.hash(testPassword, 10);
          await adminUser.update({ password: newHash });
          console.log("✅ Password reset successfully!");
          console.log("📋 Login with:");
          console.log("   Username: xtown");
          console.log("   Password:", testPassword);
        }
      } else {
        console.log("⚠️  Admin user 'xtown' not found. Creating...");
        
        const hashedPassword = await bcrypt.hash(
          process.env.ADMIN_PASSWORD || "admin123",
          10
        );

        const newAdmin = await User.create({
          username: "xtown",
          password: hashedPassword,
          role: "admin",
          createdBy: "system",
        });

        console.log("✅ Admin user created!");
        console.log("📋 Login credentials:");
        console.log("   Username: xtown");
        console.log("   Password:", process.env.ADMIN_PASSWORD || "admin123");
        console.log("   User ID:", newAdmin.id);
      }
    }
  } catch (err) {
    console.error("❌ Error seeding admin user:", err.message);
    console.error("Stack trace:", err.stack);
  }
}
