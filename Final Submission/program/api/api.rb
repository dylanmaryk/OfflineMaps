require 'pg'
require 'sinatra'
require 'sinatra/cross_origin'
 
set :port, 8110
set :environment, :production
set :logging, false

configure do
	enable :cross_origin
end

get '/name' do
	conn = PG::Connection.open(:dbname => 'offlinemaps', :user => 'postgres', :password => 'offlinemaps')
	res = conn.exec_params('SELECT * FROM geoname ORDER BY ST_Distance(coord, ST_SetSRID(ST_MakePoint($1, $2), 4326)) ASC LIMIT 1', [params[:lat], params[:long]])
	res[0]['name']
end