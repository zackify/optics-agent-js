import { loadProto } from 'protobufjs';




// copied and pasted instead of a seperate file so we can load w/o doing
// async I/O at startup.
const protoBuilder = loadProto(`
// reports 0.2.20160823.0

syntax = "proto3";

import "google/protobuf/descriptor.proto";

option java_package = "com.apollostack.optics.proto";
option optimize_for = SPEED;

extend google.protobuf.FieldOptions {
	// Used for documentation purposes only, as protobuf 3 does not support any indication of required/optional.
	// Unless a field is annotated with [(optional)=true], expect that a correct value is required.
	bool optional = 50000;
}

message Id128 {
	sfixed64 high = 1 [(optional)=false];
	sfixed64 low = 2 [(optional)=false];
}

message Timestamp {
	// Represents seconds of UTC time since Unix epoch
	// 1970-01-01T00:00:00Z. Must be from from 0001-01-01T00:00:00Z to
	// 9999-12-31T23:59:59Z inclusive.
	int64 seconds = 1 [(optional)=false];

	// Non-negative fractions of a second at nanosecond resolution. Negative
	// second values with fractions must still have non-negative nanos values
	// that count forward in time. Must be from 0 to 999,999,999
	// inclusive.
	int32 nanos = 2 [(optional)=false];
}

message Error {
	string message = 1 [(optional)=false];
}

message Trace {
	Id128 server_id = 1 [(optional)=false];
	Id128 client_id = 2 [(optional)=true];

	Timestamp start_time = 4 [(optional)=false];

	// Parsed, filtered for op (incl. fragments), reserialized
	string signature = 5 [(optional)=false];

	message Details {
		map<string, bytes> variables = 1 [(optional)=true];
		string raw_query = 2 [(optional)=true];
		string operation_name = 3 [(optional)=true];
	}
	Details details = 6 [(optional)=true];

	string client_name = 7 [(optional)=false];
	string client_version = 8 [(optional)=false];
	string client_address = 9 [(optional)=false];

	message HTTPInfo {
		enum Method {
			UNKNOWN = 0;
			OPTIONS = 1;
			GET = 2;
			HEAD = 3;
			POST = 4;
			PUT = 5;
			DELETE = 6;
			TRACE = 7;
			CONNECT = 8;
			PATCH = 9;
		}
		Method method = 1 [(optional)=true];
		string host = 2 [(optional)=true];
		string path = 3 [(optional)=true];

		// Should exclude manual blacklist ("Auth" by default)
		map<string, string> headers = 4 [(optional)=true];

		bool secure = 8 [(optional)=true]; // TLS was used
		string protocol = 9 [(optional)=true]; // by convention "HTTP/1.0", "HTTP/1.1" or "h2"
	}
	HTTPInfo http = 10 [(optional)=true];

	message Node {
		oneof id {
			string field_name = 1;
			uint32 index = 2;
		}

		string type = 3 [(optional)=false];
		string alias = 4 [(optional)=true];

		// relative to the trace's start_time, in ns
		uint64 start_time = 8 [(optional)=false];
		uint64 end_time = 9 [(optional)=true];

		Error error = 11 [(optional)=true];
		repeated Node children = 12 [(optional)=false];
	}

	Node parse = 12 [(optional)=true];
	Node validate = 13 [(optional)=true];
	Node execute = 14 [(optional)=false];
}

message ReportHeader {
	string auth_token = 1 [(optional)=false];
	string account = 2 [(optional)=false];
	string service = 3 [(optional)=false];
	string environment = 4 [(optional)=true];
	// eg "api.example.com"
	string hostname = 5 [(optional)=true];

	// eg "optics-agent-js 0.1.0"
	string agent_version = 6 [(optional)=false];
	// eg "prod-4279-20160804T065423Z-5-g3cf0aa8" (taken from \`git describe --tags\`)
	string service_version = 7 [(optional)=true];
	// eg "node v4.6.0"
	string runtime_version = 8 [(optional)=true];
	// eg "Linux box 4.6.5-1-ec2 #1 SMP Mon Aug 1 02:31:38 PDT 2016 x86_64 GNU/Linux"
	string uname = 9 [(optional)=true];
}

message StatsPerClientName {
	repeated uint64 latency_counts = 1 [(optional)=false];
	repeated uint64 error_counts = 2 [(optional)=false];
	map<string, uint64> count_per_version_version = 3 [(optional)=false];
}
message StatsPerSignature {
	map<string, StatsPerClientName> per_client_name = 1 [(optional)=false];
}

// Top-level message type for the server-side traces endpoint
message TracesReport {
	ReportHeader header = 1 [(optional)=false];
	repeated Trace traces = 2 [(optional)=false];
}

// Top-level message type for the server-side stats endpoint
message StatsReport {
	ReportHeader header = 1 [(optional)=false];
	string schema = 2 [(optional)=false];

	Timestamp start_time = 8 [(optional)=false];
	Timestamp end_time = 9 [(optional)=false];

	map<string, StatsPerSignature> per_signature = 12 [(optional)=false];
}

/*
Notes on histograms:
Frozen HdrHistogram(?), no need to pass zeroes
*/

/*
Notes on query signatures:

query Foo {
  user("hello") { n: name }
    ... Baz
}
fragment Bar on User {
  age
}
fragment Baz on User {
  dob
}
=>
query Foo { user("") { name ...Baz } } fragment Baz on User { age }
--- or (config) ---
query Foo { user("hello") { name } } fragment Baz on User { age }

cleanup:
"foo" => ""
1.24  => 0
RED   => RED
*/
`, null, "reports.proto");


export const Trace = protoBuilder.build("Trace");

export const TracesReport = protoBuilder.build("TracesReport");

export const StatsReport = protoBuilder.build("StatsReport");
