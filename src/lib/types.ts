export interface Tweet {
    id?: string;
    timestamp: number;
    timestr?: string | number;
    text?: string;
    msg?: string; // API uses 'msg' for tweet content
    baseid?: string; // API uses lowercase 'baseid'
    jishu?: number;
    type?: string;
    action?: string;
    xid?: string; // Added field seen in API response
}

export interface TweetStatus {
    [date: string]: { [hour: string]: number | { count: number } };
}

export interface HeatmapData {
    [date: string]: {
        [hour: number]: { count: number }
    };
}

export interface CountData {
    count: number;
}

export interface TweetStatusRawResponse {
    posts: Array<{ date: string;[hour: string]: any }>;
    t?: Array<{ timestamp: number; timestr: string }>;
}

