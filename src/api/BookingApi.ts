//How to perform serialize and deserialize your response
//How to perform JSON Schema Validation
//How to perform json path plus
//Use auth,JWT token..

import { APIResponse } from "@playwright/test";
import { ApiContext, ApiHelper } from '@utils/APIHelper'

export interface BookingDates {
    checkin: string;
    checkout: string;
}

export interface Booking {
    firstname: string;
    lastname: string;
    totalprice: number;
    depositpaid: boolean;
    bookingdates: BookingDates;
    additionalneeds: string;
}

export interface CreateBookingResponse {
    bookingid: number;
    booking: Booking;
}

export interface TokenPayload {
    username: string;
    password: string;
}

export interface TokenResponse {
    token?: string;
    reason?: string;
}

export interface BookingId {
    bookingid: number;
}

export interface BookingFilters {
    firstname?: string;
    lastname?: string;
    checkin?: string;
    checkout?: string;
}

const JSON_HEADERS = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
}

export class BookingApi {
    private apiHelper: ApiHelper;
    private baseUrl: string;

    constructor(context: ApiContext, baseUrl = "https://restful-booker.herokuapp.com") {
        this.apiHelper = new ApiHelper(context);
        this.baseUrl = baseUrl;
    }

    private authHeaders(token: string): Record<string, string> {
        return { ...JSON_HEADERS, Cookie: `token=${token}` }
    }

    async getAllBookings(filters?: BookingFilters): Promise<BookingId[]> {
        const response = await this.apiHelper.get(`${this.baseUrl}/booking`, {
            params: filters as Record<string, string> | undefined
        })

        if (!this.apiHelper.isSuccess(response)) {
            throw new Error(`[BookingApi] GET all bookings failed: ${response.status()}`)
        }
        return this.apiHelper.parseJsonResponse<BookingId[]>(response)
    }

    async getBookingResponse(id: number): Promise<APIResponse> {
        return this.apiHelper.get(`${this.baseUrl}/booking/${id}`)
    }

    async getBooking(id: number): Promise<Booking> {
        const response = await this.getBookingResponse(id);
        if (!this.apiHelper.isSuccess(response)) {
            throw new Error(`[BookingApi] GET /booking/${id} booking details failed: ${response.status()} `)
        }

        return this.apiHelper.parseJsonResponse<Booking>(response);
    }

    async getAuthResponse(username = "admin", password = 'password123'): Promise<APIResponse> {
        const payload: TokenPayload = {
            username,
            password,
        };
        return this.apiHelper.post(`${this.baseUrl}/auth`,payload, { headers: JSON_HEADERS });
    }

    async getAuthToken(username = "admin", password = 'password123'): Promise<string> {
        

        const response = await this.getAuthResponse(username, password)
        if (!this.apiHelper.isSuccess(response)) {
            throw new Error(`[BookingApi] POST /auth failed: ${response.status()} `)
        }
        const body = await this.apiHelper.parseJsonResponse<TokenResponse>(response)
        if (!body.token) {
            throw new Error(`[BookingApi] /auth returned no token. Reason: ${body.reason ?? 'unknown'}`)
        }

        return body.token
    }
    async createBookingResponse(payload: unknown): Promise<APIResponse> {
        return this.apiHelper.post(`${this.baseUrl}/booking`, payload, { headers: JSON_HEADERS });
    }
    async createBooking(payload:Booking):Promise<CreateBookingResponse>{
        const response=await this.createBookingResponse(payload);
        if(!this.apiHelper.isSuccess(response)){
            throw new Error(`[BookingApi] POST /booking failed: ${response.status()}`)
        }

        return this.apiHelper.parseJsonResponse<CreateBookingResponse>(response)
    }

    async updateBookingResponse(bookingId:number,payload:Booking,token:string): Promise<APIResponse> {
        return this.apiHelper.put(`${this.baseUrl}/booking/${bookingId}`,payload,
            {headers:this.authHeaders(token)}
        );
    }
    
    async updateBooking(bookingId:number,payload:Booking,token:string):Promise<Booking>{
        const response=await this.updateBookingResponse(bookingId,payload,token)
        if(!this.apiHelper.isSuccess(response)){
            throw new Error(`[BookingApi] PUT /booking/${bookingId} failed: ${response.status()}`)
        }

        return this.apiHelper.parseJsonResponse<Booking>(response)
    }

    async patchUpdateBookingResponse(bookingId:number,payload:Partial<Booking>,token:string):Promise<APIResponse>{
        return this.apiHelper.patch(`${this.baseUrl}/booking/${bookingId}`,payload,
            {headers:this.authHeaders(token)}
        );
    }

    async partialUpdateBooking(bookingId:number,payload:Partial<Booking>,token:string):Promise<Booking>{
        const response=await this.patchUpdateBookingResponse(bookingId,payload,token)
        if(!this.apiHelper.isSuccess(response)){
            throw new Error(`[BookingApi] PATCH /booking/${bookingId} failed: ${response.status()}`)
        }

        return this.apiHelper.parseJsonResponse<Booking>(response)
    }

    async deleteBookingResponse(bookingId:number,token:string):Promise<APIResponse>{
        return this.apiHelper.delete(`${this.baseUrl}/booking/${bookingId}`,
            {headers:this.authHeaders(token)}
        );
    }

    async deleteBooking(bookingId:number,token:string):Promise<Number>{
        const response=await this.deleteBookingResponse(bookingId,token)
        if(!this.apiHelper.isSuccess(response)){
            throw new Error(`[BookingApi] PATCH /booking/${bookingId} failed: ${response.status()}`)
        }

        return response.status();
    }
}

