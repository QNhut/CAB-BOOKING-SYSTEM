import { Router } from "express";
import { healthCheck, getAutocomplete, getPlaceDetails, reverseGeo } from "../controllers/geo.controller.js";

const router = Router();

router.get("/health",               healthCheck);
router.get("/geo/autocomplete",     getAutocomplete);
router.get("/geo/place/:placeId",   getPlaceDetails);
router.get("/geo/reverse",          reverseGeo);

export default router;
