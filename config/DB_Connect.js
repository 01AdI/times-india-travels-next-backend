const mongoose=require("mongoose");

async function  DBConnect() {
    try{
        await mongoose.connect(process.env.MONGODB_URL);

    }catch(err){
        console.error("DB Connection Error:", err.message);
        process.exit(1);
    }
    
}

module.exports= DBConnect;