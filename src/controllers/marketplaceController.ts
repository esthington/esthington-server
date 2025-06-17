import type { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../utils/appError";
import { MarketplaceListing, ListingStatus } from "../models/marketplaceModel";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../services/cloudinaryService";
import { asyncHandler } from "../utils/asyncHandler";
import mongoose from "mongoose";
import User from "../models/userModel";
import {
  PaymentMethod,
  Transaction,
  TransactionStatus,
  TransactionType,
  Wallet,
} from "../models/walletModel";
import notificationService from "../services/notificationService";
import { NotificationType } from "../models/notificationModel";
import { processReferralCommissions } from "../services/referralService";
import { v4 as uuidv4 } from "uuid";

// @desc    Get all marketplace listings
// @route   GET /api/marketplace/listingsx
// @access  Public
export const getMarketplaceListings = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      type,
      minPrice,
      maxPrice,
      location,
      search,
      featured,
      inStock,
      category,
      sort = "createdAt",
      limit = 20,
      page = 1,
    } = req.query;

    // Build query
    const query: any = { status: "available" };

    // Filter by type
    if (type && type !== "all") {
      query.type = type;
    }

    // Filter by price range
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // Filter by location
    if (location && location !== "all") {
      query.location = { $regex: location, $options: "i" };
    }

    // Filter by search term
    if (search) {
      query.$text = { $search: search as string };
    }

    // Filter by featured
    if (featured === "true") {
      query.featured = true;
    }

    // Filter by stock status
    if (inStock === "true") {
      query.quantity = { $gt: 0 };
    }

    // Filter by category
    if (category && category !== "all") {
      query.categories = category;
    }

    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Determine sort field and direction
    let sortOptions: any = { createdAt: -1 }; // Default sort by newest

    if (sort === "price-high") {
      sortOptions = { price: -1 };
    } else if (sort === "price-low") {
      sortOptions = { price: 1 };
    } else if (sort === "trending") {
      sortOptions = { trending: -1, createdAt: -1 };
    } else if (sort === "featured") {
      sortOptions = { featured: -1, createdAt: -1 };
    } else if (sort === "discount") {
      // We'll handle this in memory since it requires calculation
      sortOptions = { discountedPrice: 1, createdAt: -1 };
    }

    // Execute query with pagination and sorting
    const listings = await MarketplaceListing.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(Number(limit))
      .populate("companyId", "name logo");

    // Get total count for pagination
    const total = await MarketplaceListing.countDocuments(query);

    // Transform data to match client expectations
    const transformedListings = listings.map((listing) => {
      const listingObj = listing.toObject();
      return {
        ...listingObj,
        id: listingObj._id,
      };
    });

    res.status(StatusCodes.OK).json({
      success: true,
      count: listings.length,
      total,
      pages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      data: transformedListings,
    });
  }
);

// @desc    Get marketplace listing by ID
// @route   GET /api/marketplace/listings/:id
// @access  Public
export const getMarketplaceListingById = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("Invalid listing ID", StatusCodes.BAD_REQUEST));
    }

    const listing = await MarketplaceListing.findById(id).populate(
      "companyId",
      "name logo"
    );

    if (!listing) {
      return next(new AppError("Listing not found", StatusCodes.NOT_FOUND));
    }



    // Transform data to match client expectations
    const listingObj = listing.toObject();
    const transformedListing = {
      ...listingObj,
      id: listingObj._id,
    };


    res.status(StatusCodes.OK).json({
      success: true,
      data: listing,
    });
  }
);

// @desc    Create marketplace listing
// @route   POST /api/marketplace/listings
// @access  Private (Admin)
export const createMarketplaceListing = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    console.log("===> Entered createMarketplaceListing handler");

    if (!req.user) {
      console.log("User not authenticated");
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    // Check if user is admin
    const user = await User.findById(req.user.id);
    if (!user) {
      console.log("User not found");
      return next(new AppError("User not found", StatusCodes.NOT_FOUND));
    }

    if (!user.role.includes("admin") && !user.role.includes("super_admin")) {
      console.log("User does not have permission");
      return next(
        new AppError(
          "You do not have permission to create listings",
          StatusCodes.FORBIDDEN
        )
      );
    }

    console.log("Parsing listing data from request body");
    const listingData = JSON.parse(req.body.data || "{}");

    console.log("Validating required fields");
    if (
      !listingData.title ||
      !listingData.description ||
      !listingData.price ||
      !listingData.type ||
      !listingData.location
    ) {
      console.log("Missing required fields");
      return next(
        new AppError(
          "Please provide all required fields",
          StatusCodes.BAD_REQUEST
        )
      );
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    console.log("Handling file uploads", Object.keys(files));

    // Upload thumbnail
    let thumbnailUrl = "";
    if (files.thumbnail && files.thumbnail[0]) {
      console.log("Uploading thumbnail to Cloudinary");
      const thumbnailResult = await uploadToCloudinary(
        files.thumbnail[0].path,
        "marketplace/thumbnails"
      );
      thumbnailUrl = thumbnailResult.secure_url;
      console.log("Thumbnail uploaded:", thumbnailUrl);
    }

    // Upload gallery images
    const galleryUrls: string[] = [];
    if (files.gallery) {
      console.log("Uploading gallery images to Cloudinary");
      for (const file of files.gallery) {
        const result = await uploadToCloudinary(
          file.path,
          "marketplace/gallery"
        );
        galleryUrls.push(result.secure_url);
      }
      console.log("Gallery images uploaded:", galleryUrls);
    }

    // Upload documents
    const documentUrls: string[] = [];
    if (files.documents) {
      console.log("Uploading documents to Cloudinary");
      for (const file of files.documents) {
        const result = await uploadToCloudinary(
          file.path,
          "marketplace/documents"
        );
        documentUrls.push(result.secure_url);
      }
      console.log("Documents uploaded:", documentUrls);
    }

    // Set default values for missing fields
    const defaultExpiresAt = new Date();
    defaultExpiresAt.setFullYear(defaultExpiresAt.getFullYear() + 1); // Default expiry is 1 year from now

    console.log("Creating listing in database");
    const listing = await MarketplaceListing.create({
      ...listingData,
      thumbnail: thumbnailUrl,
      gallery: galleryUrls,
      documents: documentUrls,
      images: [thumbnailUrl, ...galleryUrls], // For backward compatibility
      creatorId: req.user.id,
      status:
        listingData.quantity > 0
          ? ListingStatus.AVAILABLE
          : ListingStatus.OUT_OF_STOCK,
      expiresAt: listingData.expiresAt || defaultExpiresAt,
    });

    // Transform data to match client expectations
    const listingObj = listing.toObject();
    const transformedListing = {
      ...listingObj,
      id: listingObj._id,
    };

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Listing created successfully",
      data: transformedListing,
    });
  }
);

// @desc    Update marketplace listing
// @route   PUT /api/marketplace/listings/:id
// @access  Private (Admin or Creator)
export const updateMarketplaceListing = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    console.log("1");

    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    console.log("2");

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("Invalid listing ID", StatusCodes.BAD_REQUEST));
    }

    console.log("3");

    const listing = await MarketplaceListing.findById(id);
    if (!listing) {
      return next(new AppError("Listing not found", StatusCodes.NOT_FOUND));
    }

    // Check if user is the creator or admin
    if (listing.creatorId !== req.user.id && !req.user.role.includes("admin")) {
      return next(
        new AppError(
          "Not authorized to update this listing",
          StatusCodes.FORBIDDEN
        )
      );
    }

    console.log("4");
    // Parse the JSON data from the form
    const listingData = JSON.parse(req.body.data || "{}");

    // Handle file uploads
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    // Upload thumbnail if provided
    if (files.thumbnail && files.thumbnail[0]) {
      // Delete old thumbnail if exists
      if (listing.thumbnail) {
        await deleteFromCloudinary(listing.thumbnail);
      }
      const thumbnailResult = await uploadToCloudinary(
        files.thumbnail[0].path,
        "marketplace/thumbnails"
      );
      listingData.thumbnail = thumbnailResult.secure_url;
    }

    // Upload gallery images if provided
    if (files.gallery && files.gallery.length > 0) {
      const galleryUrls: string[] = [];
      for (const file of files.gallery) {
        const result = await uploadToCloudinary(
          file.path,
          "marketplace/gallery"
        );
        galleryUrls.push(result.secure_url);
      }
      listingData.gallery = [...(listing.gallery || []), ...galleryUrls];
    }

    // Upload documents if provided
    if (files.documents && files.documents.length > 0) {
      const documentUrls: string[] = [];
      for (const file of files.documents) {
        const result = await uploadToCloudinary(
          file.path,
          "marketplace/documents"
        );
        documentUrls.push(result.secure_url);
      }
      listingData.documents = [...(listing.documents || []), ...documentUrls];
    }

    // Update images array for backward compatibility
    if (listingData.thumbnail || listingData.gallery) {
      listingData.images = [
        listingData.thumbnail || listing.thumbnail || "",
        ...(listingData.gallery || listing.gallery || []),
      ].filter(Boolean);
    }

    console.log("5");
    // Update status based on quantity
    if (listingData.quantity !== undefined) {
      listingData.status =
        listingData.quantity > 0
          ? ListingStatus.AVAILABLE
          : ListingStatus.OUT_OF_STOCK;
    }

    console.log("6", listingData);

    // Update listing
    try {
      const updatedListing = await MarketplaceListing.findByIdAndUpdate(
        id,
        listingData,
        { new: true, runValidators: true, context: "query" }
      ).populate("companyId", "name logo");

      console.log("7");

      if (!updatedListing) {
        return next(
          new AppError(
            "Failed to update listing",
            StatusCodes.INTERNAL_SERVER_ERROR
          )
        );
      }

      console.log("8");
      // Transform data to match client expectations
      const listingObj = updatedListing.toObject();
      const transformedListing = {
        ...listingObj,
        id: listingObj._id,
      };

      res.status(StatusCodes.OK).json({
        success: true,
        message: "Listing updated successfully",
        data: transformedListing,
      });
    } catch (err) {
      console.error("Update failed:", err);
      return next(new AppError("Database update error", 500));
    }
  }
);

// @desc    Delete marketplace listing
// @route   DELETE /api/marketplace/listings/:id
// @access  Private (Admin or Creator)
export const deleteMarketplaceListing = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const listing = await MarketplaceListing.findById(id);

    if (!listing) {
      return next(new AppError("Listing not found", StatusCodes.NOT_FOUND));
    }

    // Check if user is the creator or admin
    if (listing.creatorId !== req.user.id && !req.user.role.includes("admin")) {
      return next(
        new AppError(
          "Not authorized to delete this listing",
          StatusCodes.FORBIDDEN
        )
      );
    }

    // Delete all associated files from Cloudinary
    if (listing.thumbnail) {
      await deleteFromCloudinary(listing.thumbnail);
    }

    if (listing.gallery && listing.gallery.length > 0) {
      for (const image of listing.gallery) {
        await deleteFromCloudinary(image);
      }
    }

    if (listing.documents && listing.documents.length > 0) {
      for (const doc of listing.documents) {
        await deleteFromCloudinary(doc);
      }
    }

    await MarketplaceListing.findByIdAndDelete(id);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Listing deleted successfully",
    });
  }
);

// @desc    Upload marketplace listing images
// @route   POST /api/marketplace/listings/:id/images
// @access  Private (Admin or Creator)
export const uploadMarketplaceImages = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("Invalid listing ID", StatusCodes.BAD_REQUEST));
    }

    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const listing = await MarketplaceListing.findById(id);

    if (!listing) {
      return next(new AppError("Listing not found", StatusCodes.NOT_FOUND));
    }

    // Check if user is the creator or admin
    if (listing.creatorId !== req.user.id && !req.user.role.includes("admin")) {
      return next(
        new AppError(
          "Not authorized to update this listing",
          StatusCodes.FORBIDDEN
        )
      );
    }

    if (!req.files || Object.keys(req.files).length === 0) {
      return next(
        new AppError("No files were uploaded", StatusCodes.BAD_REQUEST)
      );
    }

    // Upload images to Cloudinary
    const uploadPromises = Object.values(req.files).map(async (file: any) => {
      if (Array.isArray(file)) {
        return Promise.all(
          file.map(async (f) =>
            uploadToCloudinary(f.path, "marketplace/gallery")
          )
        );
      } else {
        return uploadToCloudinary(file.path, "marketplace/gallery");
      }
    });

    const results = await Promise.all(uploadPromises);

    // Extract secure URLs from Cloudinary responses
    const images = results.flat().map((result) => result.secure_url);

    // Update listing with image URLs
    listing.gallery = [...(listing.gallery || []), ...images];
    listing.images = [...(listing.images || []), ...images]; // For backward compatibility
    await listing.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Images uploaded successfully",
      data: { images: listing.gallery },
    });
  }
);

// @desc    Update listing quantity
// @route   PATCH /api/marketplace/listings/:id/quantity
// @access  Private (Admin or Creator)
export const updateListingQuantity = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { quantity } = req.body;

    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("Invalid listing ID", StatusCodes.BAD_REQUEST));
    }

    if (quantity === undefined || quantity < 0) {
      return next(
        new AppError("Valid quantity is required", StatusCodes.BAD_REQUEST)
      );
    }

    const listing = await MarketplaceListing.findById(id);

    if (!listing) {
      return next(new AppError("Listing not found", StatusCodes.NOT_FOUND));
    }

    // Check if user is the creator or admin
    if (listing.creatorId !== req.user.id && !req.user.role.includes("admin")) {
      return next(
        new AppError(
          "Not authorized to update this listing",
          StatusCodes.FORBIDDEN
        )
      );
    }

    // Update quantity and status
    listing.quantity = quantity;
    listing.status =
      quantity > 0 ? ListingStatus.AVAILABLE : ListingStatus.OUT_OF_STOCK;
    await listing.save();

    // Transform data to match client expectations
    const listingObj = listing.toObject();
    const transformedListing = {
      ...listingObj,
      id: listingObj._id,
    };

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Quantity updated successfully",
      data: transformedListing,
    });
  }
);

// @desc    Feature or unfeature a listing
// @route   PATCH /api/marketplace/listings/:id/feature
// @access  Private (Admin only)
export const featureListing = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { featured } = req.body;

    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    // Only admin can feature listings
    if (!req.user.role.includes("admin")) {
      return next(
        new AppError(
          "Not authorized to feature listings",
          StatusCodes.FORBIDDEN
        )
      );
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("Invalid listing ID", StatusCodes.BAD_REQUEST));
    }

    if (featured === undefined) {
      return next(
        new AppError("Featured status is required", StatusCodes.BAD_REQUEST)
      );
    }

    const listing = await MarketplaceListing.findById(id);

    if (!listing) {
      return next(new AppError("Listing not found", StatusCodes.NOT_FOUND));
    }

    // Update featured status
    listing.featured = featured;
    await listing.save();

    // Transform data to match client expectations
    const listingObj = listing.toObject();
    const transformedListing = {
      ...listingObj,
      id: listingObj._id,
    };

    res.status(StatusCodes.OK).json({
      success: true,
      message: featured
        ? "Listing featured successfully"
        : "Listing unfeatured successfully",
      data: transformedListing,
    });
  }
);

// @desc    Set trending status for a listing
// @route   PATCH /api/marketplace/listings/:id/trending
// @access  Private (Admin only)
export const setTrendingStatus = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { trending } = req.body;

    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    // Only admin can set trending status
    if (!req.user.role.includes("admin")) {
      return next(
        new AppError(
          "Not authorized to set trending status",
          StatusCodes.FORBIDDEN
        )
      );
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("Invalid listing ID", StatusCodes.BAD_REQUEST));
    }

    if (trending === undefined) {
      return next(
        new AppError("Trending status is required", StatusCodes.BAD_REQUEST)
      );
    }

    const listing = await MarketplaceListing.findById(id);

    if (!listing) {
      return next(new AppError("Listing not found", StatusCodes.NOT_FOUND));
    }

    // Update trending status
    listing.trending = trending;
    await listing.save();

    // Transform data to match client expectations
    const listingObj = listing.toObject();
    const transformedListing = {
      ...listingObj,
      id: listingObj._id,
    };

    res.status(StatusCodes.OK).json({
      success: true,
      message: trending
        ? "Listing set as trending"
        : "Listing removed from trending",
      data: transformedListing,
    });
  }
);



// @desc    Purchase marketplace item
// @route   POST /api/marketplace/:id/purchase
// @access  Private
export const initiateMarketplacePurchase = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  console.log("[INIT] Initiating marketplace purchase process...")

  const { id } = req.params
  const { quantity = 1, notes = "", deliveryAddress = "" } = req.body

  console.log("[AUTH] Verifying user authentication...")
  if (!req.user) {
    return next(new AppError("User not authenticated", StatusCodes.UNAUTHORIZED))
  }

  const userId = req.user._id

  console.log("[VALIDATION] Validating input parameters...")
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError("Invalid marketplace item ID", StatusCodes.BAD_REQUEST))
  }

  if (quantity <= 0) {
    return next(new AppError("Quantity must be greater than 0", StatusCodes.BAD_REQUEST))
  }

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("Purchase operation timed out")), 30000)
  })

  try {
    const purchasePromise = async () => {
      console.log("[DB] Fetching marketplace item...")
      const marketplaceItem = await MarketplaceListing.findById(id)

      if (!marketplaceItem) {
        return next(new AppError("Marketplace item not found", StatusCodes.NOT_FOUND))
      }

      console.log("[CHECK] Checking item availability...")
      if (marketplaceItem.status !== ListingStatus.AVAILABLE) {
        return next(new AppError("This item is no longer available", StatusCodes.BAD_REQUEST))
      }

      if (!marketplaceItem.isQuantityAvailable(quantity)) {
        return next(
          new AppError(`Insufficient stock. Only ${marketplaceItem.quantity} items available`, StatusCodes.BAD_REQUEST),
        )
      }

      const unitPrice = marketplaceItem.discountedPrice || marketplaceItem.price
      const totalAmount = unitPrice * quantity

      console.log("[DB] Fetching buyer and wallet info...")
      const buyer = await User.findById(userId)
      if (!buyer) {
        return next(new AppError("Buyer not found", StatusCodes.NOT_FOUND))
      }

      const buyerWallet = await Wallet.findOne({ user: userId })
      if (!buyerWallet) {
        return next(new AppError("Buyer wallet not found", StatusCodes.NOT_FOUND))
      }

      console.log("[CHECK] Verifying wallet balance...")
      if (buyerWallet.availableBalance < totalAmount) {
        return next(new AppError("Insufficient wallet balance", StatusCodes.BAD_REQUEST))
      }

      console.log("[DB] Fetching system user and wallet...")
      const systemUser = await User.findOne({ email: "esthington@gmail.com" })
      if (!systemUser) {
        return next(new AppError("System user not found", StatusCodes.NOT_FOUND))
      }

      let systemWallet = await Wallet.findOne({ user: systemUser._id })
      if (!systemWallet) {
        console.log("[DB] Creating system wallet...")
        systemWallet = await Wallet.create({
          user: systemUser._id,
          balance: 0,
          availableBalance: 0,
          pendingBalance: 0,
        })
      }

      console.log("[TRANSACTION] Starting MongoDB session...")
      const session = await mongoose.startSession()
      session.startTransaction()

      try {
        const reference = `MKT-${id}-${Date.now()}-${uuidv4().substring(0, 8)}`
        const purchaseId = `PUR-${Date.now()}-${uuidv4().substring(0, 8)}`
        console.log(`[TRANSACTION] Generated reference: ${reference}`)

        console.log("[TRANSACTION] Creating buyer transaction...")
        const buyerTransaction = await Transaction.create(
          [
            {
              user: userId,
              type: TransactionType.MARKETPLACE_PURCHASE,
              amount: totalAmount,
              status: TransactionStatus.COMPLETED,
              reference: reference,
              description: `Marketplace purchase: ${marketplaceItem.title} (Qty: ${quantity})`,
              paymentMethod: PaymentMethod.WALLET,
              recipient: systemUser._id,
              metadata: {
                marketplaceItemId: id,
                itemTitle: marketplaceItem.title,
                quantity: quantity,
                unitPrice: unitPrice,
                notes: notes,
                purchaseId: purchaseId,
                deliveryAddress: deliveryAddress,
              },
            },
          ],
          { session },
        )

        console.log("[TRANSACTION] Creating system (credit) transaction...")
        const systemTransaction = await Transaction.create(
          [
            {
              user: systemUser._id,
              type: TransactionType.MARKETPLACE_PURCHASE,
              amount: totalAmount,
              status: TransactionStatus.COMPLETED,
              reference: reference,
              description: `Marketplace sale received from ${buyer.firstName} ${buyer.lastName} for ${marketplaceItem.title}`,
              paymentMethod: PaymentMethod.WALLET,
              sender: userId,
              metadata: {
                marketplaceItemId: id,
                itemTitle: marketplaceItem.title,
                quantity: quantity,
                buyerName: `${buyer.firstName} ${buyer.lastName}`,
                unitPrice: unitPrice,
                purchaseId: purchaseId,
              },
            },
          ],
          { session },
        )

        console.log("[WALLET] Updating buyer wallet...")
        buyerWallet.balance -= totalAmount
        buyerWallet.availableBalance -= totalAmount
        await buyerWallet.save({ session })

        console.log("[WALLET] Updating system wallet...")
        systemWallet.balance += totalAmount
        systemWallet.availableBalance += totalAmount
        await systemWallet.save({ session })

        console.log("[ITEM] Updating marketplace item with purchase...")
        // Create purchase data
        const purchaseData = {
          purchaseId: purchaseId,
          buyerId: userId,
          buyerName: `${buyer.firstName} ${buyer.lastName}`,
          buyerEmail: buyer.email,
          quantity: quantity,
          unitPrice: unitPrice,
          totalAmount: totalAmount,
          purchaseDate: new Date(),
          transactionRef: reference,
          notes: notes,
          deliveryAddress: deliveryAddress,
          deliveryStatus: "pending",
        }

        // Add purchase to the item
        marketplaceItem.purchases.push(purchaseData)

        // Update quantities directly
        marketplaceItem.soldQuantity = (marketplaceItem.soldQuantity || 0) + quantity
        marketplaceItem.quantity = Math.max(0, marketplaceItem.quantity - quantity)

        // Update status if needed
        if (marketplaceItem.quantity <= 0) {
          marketplaceItem.status = ListingStatus.SOLD
        }

        // Save the marketplace item
        await marketplaceItem.save({ session })

        console.log("[REFERRAL] Processing referral commissions...")
        await processReferralCommissions(userId, "marketplace", totalAmount, session, undefined, reference)

        console.log("[NOTIFICATION] Creating purchase and sale notifications...")
        const notificationPromises = [
          notificationService.createNotification(
            userId.toString(),
            "Purchase Successful",
            `Your purchase of ${marketplaceItem.title} (Qty: ${quantity}) for ₦${totalAmount.toLocaleString()} has been completed successfully.`,
            NotificationType.TRANSACTION,
            "/dashboard/my-purchases",
            {
              transactionId: buyerTransaction[0]._id,
              marketplaceItemId: id,
              purchaseId: purchaseId,
            },
          ),
          notificationService.createNotification(
            systemUser._id.toString(),
            "New Marketplace Sale",
            `New sale of ₦${totalAmount.toLocaleString()} received from ${buyer.firstName} ${buyer.lastName} for ${marketplaceItem.title} (Qty: ${quantity}).`,
            NotificationType.TRANSACTION,
            "/admin/marketplace",
            {
              transactionId: systemTransaction[0]._id,
              marketplaceItemId: id,
              buyerId: userId,
              purchaseId: purchaseId,
            },
          ),
        ]
        await Promise.all(notificationPromises)

        console.log("[TRANSACTION] Committing transaction...")
        await session.commitTransaction()
        console.log("[SUCCESS] Marketplace purchase completed.")

        return res.status(StatusCodes.CREATED).json({
          success: true,
          message: "Purchase completed successfully! Your payment has been processed.",
          data: {
            transaction: buyerTransaction[0],
            updatedWalletBalance: buyerWallet.availableBalance,
            purchaseDetails: {
              purchaseId: purchaseId,
              itemTitle: marketplaceItem.title,
              quantity: quantity,
              unitPrice: unitPrice,
              totalAmount: totalAmount,
              reference: reference,
              deliveryStatus: "pending",
            },
            itemStatus: {
              quantity: marketplaceItem.quantity,
              soldQuantity: marketplaceItem.soldQuantity,
              status: marketplaceItem.status,
            },
          },
        })
      } catch (error) {
        console.error("[ERROR] Transaction failed, aborting...", error)
        await session.abortTransaction()
        return next(
          new AppError(
            `Purchase failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            StatusCodes.INTERNAL_SERVER_ERROR,
          ),
        )
      } finally {
        session.endSession()
        console.log("[SESSION] Session closed.")
      }
    }

    await Promise.race([purchasePromise(), timeoutPromise])
  } catch (error) {
    console.error("[FAILURE] Purchase failed or timed out:", error)

    if (error instanceof Error && error.message === "Purchase operation timed out") {
      return next(new AppError("Purchase operation timed out. Please try again.", StatusCodes.REQUEST_TIMEOUT))
    }

    return next(
      new AppError(
        `Purchase failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        StatusCodes.INTERNAL_SERVER_ERROR,
      ),
    )
  }
})




// @desc    Get listings for the current agent/creator
// @route   GET /api/marketplace/listings/agent
// @access  Private
export const getAgentListings = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const listings = await MarketplaceListing.find({ creatorId: req.user.id })
      .sort({ createdAt: -1 })
      .populate("companyId", "name logo");

    // Transform data to match client expectations
    const transformedListings = listings.map((listing) => {
      const listingObj = listing.toObject();
      return {
        ...listingObj,
        id: listingObj._id,
      };
    });

    res.status(StatusCodes.OK).json({
      success: true,
      count: listings.length,
      data: transformedListings,
    });
  }
);

// @desc    Approve a listing (admin only)
// @route   PATCH /api/marketplace/listings/:id/approve
// @access  Private (Admin only)
export const approveListing = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    // Only admin can approve listings
    if (!req.user.role.includes("admin")) {
      return next(
        new AppError(
          "Not authorized to approve listings",
          StatusCodes.FORBIDDEN
        )
      );
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("Invalid listing ID", StatusCodes.BAD_REQUEST));
    }

    const listing = await MarketplaceListing.findById(id);

    if (!listing) {
      return next(new AppError("Listing not found", StatusCodes.NOT_FOUND));
    }

    // Update status to available
    listing.status = ListingStatus.AVAILABLE;
    await listing.save();

    // Transform data to match client expectations
    const listingObj = listing.toObject();
    const transformedListing = {
      ...listingObj,
      id: listingObj._id,
    };

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Listing approved successfully",
      data: transformedListing,
    });
  }
);

// @desc    Reject a listing (admin only)
// @route   PATCH /api/marketplace/listings/:id/reject
// @access  Private (Admin only)
export const rejectListing = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { reason } = req.body;

    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    // Only admin can reject listings
    if (!req.user.role.includes("admin")) {
      return next(
        new AppError("Not authorized to reject listings", StatusCodes.FORBIDDEN)
      );
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("Invalid listing ID", StatusCodes.BAD_REQUEST));
    }

    if (!reason) {
      return next(
        new AppError("Rejection reason is required", StatusCodes.BAD_REQUEST)
      );
    }

    const listing = await MarketplaceListing.findById(id);

    if (!listing) {
      return next(new AppError("Listing not found", StatusCodes.NOT_FOUND));
    }

    // Update status to rejected and add rejection reason
    listing.status = ListingStatus.OUT_OF_STOCK;
    await listing.save();

    // Transform data to match client expectations
    const listingObj = listing.toObject();
    const transformedListing = {
      ...listingObj,
      id: listingObj._id,
    };

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Listing rejected successfully",
      data: transformedListing,
    });
  }
);

// @desc    Delete gallery image
// @route   DELETE /api/marketplace/listings/:id/gallery
// @access  Private (Admin or Creator)
export const deleteGalleryImage = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { imageUrl } = req.body;

    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("Invalid listing ID", StatusCodes.BAD_REQUEST));
    }

    if (!imageUrl) {
      return next(
        new AppError("Image URL is required", StatusCodes.BAD_REQUEST)
      );
    }

    const listing = await MarketplaceListing.findById(id);
    if (!listing) {
      return next(new AppError("Listing not found", StatusCodes.NOT_FOUND));
    }

    // Check if user is the creator or admin
    if (listing.creatorId !== req.user.id && !req.user.role.includes("admin")) {
      return next(
        new AppError(
          "Not authorized to update this listing",
          StatusCodes.FORBIDDEN
        )
      );
    }

    if (!listing.gallery || !listing.gallery.includes(imageUrl)) {
      return next(
        new AppError("Image not found in gallery", StatusCodes.NOT_FOUND)
      );
    }

    // Delete image from Cloudinary
    await deleteFromCloudinary(imageUrl);

    // Update listing
    listing.gallery = listing.gallery.filter((url: any) => url !== imageUrl);

    // Also update images array for backward compatibility
    if (listing.images) {
      listing.images = listing.images.filter((url: any) => url !== imageUrl);
    }

    await listing.save();

    // Transform data to match client expectations
    const listingObj = listing.toObject();
    const transformedListing = {
      ...listingObj,
      id: listingObj._id,
    };

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Gallery image deleted successfully",
      data: transformedListing,
    });
  }
);

// @desc    Delete document
// @route   DELETE /api/marketplace/listings/:id/documents
// @access  Private (Admin or Creator)
export const deleteDocument = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { documentUrl } = req.body;

    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("Invalid listing ID", StatusCodes.BAD_REQUEST));
    }

    if (!documentUrl) {
      return next(
        new AppError("Document URL is required", StatusCodes.BAD_REQUEST)
      );
    }

    const listing = await MarketplaceListing.findById(id);
    if (!listing) {
      return next(new AppError("Listing not found", StatusCodes.NOT_FOUND));
    }

    // Check if user is the creator or admin
    if (listing.creatorId !== req.user.id && !req.user.role.includes("admin")) {
      return next(
        new AppError(
          "Not authorized to update this listing",
          StatusCodes.FORBIDDEN
        )
      );
    }

    if (!listing.documents || !listing.documents.includes(documentUrl)) {
      return next(new AppError("Document not found", StatusCodes.NOT_FOUND));
    }

    // Delete document from Cloudinary
    await deleteFromCloudinary(documentUrl);

    // Update listing
    listing.documents = listing.documents.filter((url: any) => url !== documentUrl);
    await listing.save();

    // Transform data to match client expectations
    const listingObj = listing.toObject();
    const transformedListing = {
      ...listingObj,
      id: listingObj._id,
    };

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Document deleted successfully",
      data: transformedListing,
    });
  }
);


// @desc    Get user's marketplace purchases
// @route   GET /api/marketplace/purchases
// @access  Private
export const getUserMarketplacePurchases = asyncHandler(async (req: Request, res: Response) => {
  console.log("Fetching user marketplace purchases")

  if (!req.user?._id) {
    throw new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
  }

  const userId = req.user._id

  // Find all marketplace listings where the user has made purchases
  const listingsWithPurchases = await MarketplaceListing.find({
    "purchases.buyerId": userId,
  })
    .select("-__v")
    .populate("companyId", "name logo")
    .lean()

  // Transform the data to include only user's purchases
  const userPurchases = listingsWithPurchases.map((listing) => {
    // Filter to only the purchases made by this user
    const userPurchasesForListing = listing.purchases.filter(
      (purchase: any) => purchase.buyerId && purchase.buyerId.toString() === userId.toString(),
    )

    // Calculate user's total investment in this listing
    const totalAmount = userPurchasesForListing.reduce(
      (sum: any, purchase: any) => sum + Number(purchase.totalAmount),
      0,
    )

    // Get company details
    const companyData = listing.companyId as any

    // Transform purchases to match expected format
    const purchasedPlots = userPurchasesForListing.map((purchase: any) => ({
      _id: purchase._id,
      plotId: purchase.purchaseId, // Using purchaseId as plotId for marketplace items
      price: purchase.unitPrice,
      soldDate: purchase.purchaseDate,
      quantity: purchase.quantity,
      deliveryStatus: purchase.deliveryStatus,
      trackingNumber: purchase.trackingNumber,
    }))

    return {
      _id: listing._id,
      property: {
        _id: listing._id,
        title: listing.title,
        description: listing.description,
        location: listing.location,
        type: listing.type,
        status: listing.status,
        thumbnail: listing.thumbnail,
        planFile: listing.documents?.[0] || null, // Use first document as plan file
        documents: listing.documents || [],
        plotSize: listing.size || "N/A", // Use size field for plot size
      },
      purchasedPlots,
      totalAmount,
      companyName: companyData?.name || "",
      companyLogo: companyData?.logo || "",
    }
  })

  console.log("User marketplace purchases:", userPurchases.length)

  res.status(StatusCodes.OK).json({
    success: true,
    data: userPurchases,
    message: "User marketplace purchases fetched successfully",
  })
})