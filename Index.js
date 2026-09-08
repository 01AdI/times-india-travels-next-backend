require("dotenv").config();

const express=require("express");
const multer = require("multer");
const DBConnect=require("./config/DB_Connect");
const adminRoutes=require("./routes/adminRoutes");
const TourPackageRouter = require("./routes/TourPackageRouter");
const TourCategoryRouter = require("./routes/TourCategoryRouter");
const TourEnquiryRouter=require("./routes/tourEnquiryRoutes");
const TestimonialRoute=require("./routes/TestimonialRoute");
const BlogRoute=require("./routes/BlogRoutes");
const HomeHeroRoute=require("./routes/HomeHeroRoute");
const ClientReviewVideoRoute=require("./routes/ClientReviewVideoRoute");
const ClientGalleryRoute=require("./routes/ClientGalleryRoute");
const CarRentalRoute=require("./routes/CarRentalRoutes");
const DestinationRouter = require("./routes/DestinationRouter");
const PayNowEnquiryRouter=require("./routes/PayNowEnquiryRouter");



const cors = require("cors");


const app=express();

app.use(cors());
app.use(express.json());
app.set("trust proxy", true);

const PORT = process.env.PORT || 4000;

app.use("/admin",adminRoutes); //checked
app.use("/tour-package",TourPackageRouter);  //checked
app.use("/tour-category", TourCategoryRouter);  //checked
app.use("/tour-enquiry", TourEnquiryRouter); //checked
app.use("/car-rental-enquiry",CarRentalRoute); //checked
app.use("/pay-now",PayNowEnquiryRouter);
app.use("/testimonials",TestimonialRoute);//checked
app.use("/blog",BlogRoute); //checked 
app.use("/home-hero",HomeHeroRoute); //checked
app.use("/client-review",ClientReviewVideoRoute);
app.use("/client-gallery",ClientGalleryRoute); //checked
app.use("/destination", DestinationRouter); //checked


// The Next.js frontend owns page rendering, routing, robots.txt and sitemap.xml.
// Express is API-only in the migrated architecture.


app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // e.g. file too large
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  if (err) {
    // covers the fileFilter rejection, and anything else that reaches here
    return res.status(400).json({
      success: false,
      message: err.message || "Something went wrong with the upload.",
    });
  }

  next();
});


async function Time_India_Traveles_Backend(){
    try{
        await DBConnect();
        console.log("connected to DB");

        app.listen(PORT,()=>{
            console.log(`Server is listening on port ${PORT}`);
        })
    }
    catch(error){
            console.log("Error"+error);
    }
    
}
Time_India_Traveles_Backend();