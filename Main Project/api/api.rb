require 'pg'
require 'sinatra'
 
set :port, 8110
set :environment, :production

get '/name' do
	conn = PG::Connection.open(:dbname => 'offlinemaps', :user => 'postgres', :password => 'offlinemaps')
	res = conn.exec_params('SELECT * FROM geoname ORDER BY ST_Distance(coord, ST_SetSRID(ST_MakePoint($1, $2), 4326)) ASC LIMIT 1', [params[:lat], params[:long]])
	res[0]['name']
end

# 48.7000 44.5167